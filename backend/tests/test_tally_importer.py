import pytest
import io

MOCK_TALLY_XML = """<ENVELOPE>
  <BODY>
    <DATA>
      <LEDGER NAME="DTC Depot Delhi" PARENT="Sundry Debtors">
        <OPENINGBALANCE>-12500.00</OPENINGBALANCE>
      </LEDGER>
      <LEDGER NAME="Cash Account" PARENT="Cash-in-hand">
        <OPENINGBALANCE>0.00</OPENINGBALANCE>
      </LEDGER>
      
      <VOUCHER VCHTYPE="Sales" VOUCHERTYPENAME="Sales" VOUCHERNUMBER="TEST-VCH-001" DATE="20260721">
        <NARRATION>Petrol 50L @ 100.00 | Vehicle: DL-1C-1234</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>DTC Depot Delhi</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-5000.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Petrol Sales</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>5000.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>

      <VOUCHER VCHTYPE="Receipt" VOUCHERTYPENAME="Receipt" VOUCHERNUMBER="TEST-RCPT-001" DATE="20260721">
        <NARRATION>Cheque payment recd</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Cash Account</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-3000.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>DTC Depot Delhi</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>3000.00</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </DATA>
  </BODY>
</ENVELOPE>"""


class TestTallyImporter:

    def test_import_invalid_xml(self, client, auth_headers):
        # Phase 0: Test validation with bad XML
        files = {"file": ("bad.xml", io.BytesIO(b"<INVALID_XML_CONTENT"), "application/xml")}
        response = client.post(
            "/api/v1/tally/import",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 400
        assert "parsing failed" in response.json()["detail"]

    def test_import_masters_and_transactions(self, client, auth_headers):
        # 1. Run the valid import
        files = {"file": ("daybook.xml", io.BytesIO(MOCK_TALLY_XML.encode("utf-8")), "application/xml")}
        response = client.post(
            "/api/v1/tally/import",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        print("IMPORT RESULT:", data)
    
        # Verify counts
        assert data["customers_imported"] == 1
        assert data["vouchers_imported"] == 1
        assert data["payments_imported"] == 1
        assert data["duplicates_found"] == 0
        assert data["parse_errors"] == 0
        assert len(data["warnings"]) == 0

        # 2. Run the import again to test duplicate check and safeguards
        files_dup = {"file": ("daybook.xml", io.BytesIO(MOCK_TALLY_XML.encode("utf-8")), "application/xml")}
        response_dup = client.post(
            "/api/v1/tally/import",
            headers=auth_headers,
            files=files_dup
        )
        assert response_dup.status_code == 200
        data_dup = response_dup.json()

        # Masters should be skipped, vouchers/receipts should be detected as duplicates
        assert data_dup["customers_imported"] == 0
        assert data_dup["customers_skipped"] == 1
        assert data_dup["vouchers_imported"] == 0
        assert data_dup["payments_imported"] == 0
        assert data_dup["duplicates_found"] == 2
        assert len(data_dup["warnings"]) == 2
        assert any(w["type"] == "Duplicate Voucher" for w in data_dup["warnings"])
        assert any(w["type"] == "Duplicate Receipt" for w in data_dup["warnings"])

    def test_user_xml_import_debug(self, client, auth_headers):
        user_xml = """<?xml version="1.0" ?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER ACTION="Create" VCHTYPE="Sales">
            <DATE>20260721</DATE>
            <EFFECTIVEDATE>20260721</EFFECTIVEDATE>
            <GUID>1223a0a0-41e8-4450-b476-d5df2988be10</GUID>
            <VOUCHERNUMBER>11</VOUCHERNUMBER>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>1</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher</PERSISTEDVIEW>
            <NARRATION>Fuel: PETROL @ 11.00/L x 1.000L</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>1</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-11.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Petrol Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>11.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""
        # Create customer "1" so it exists
        client.post(
            "/api/v1/customers",
            headers=auth_headers,
            json={"name": "1", "opening_balance": "0.00"}
        )

        files = {"file": ("user_import.xml", io.BytesIO(user_xml.encode("utf-8")), "application/xml")}
        response = client.post(
            "/api/v1/tally/import",
            headers=auth_headers,
            files=files
        )
        print("STATUS:", response.status_code)
        print("TEXT:", response.text)
        assert response.status_code == 200
