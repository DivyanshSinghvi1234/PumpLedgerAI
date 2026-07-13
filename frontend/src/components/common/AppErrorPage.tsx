import { useRouteError, Link } from "react-router-dom";


type RouteError = {
    status?: number;
    statusText?: string;
    message?: string;
};

export default function AppErrorPage() {
    const error = useRouteError() as RouteError | unknown;

    const status = (error as RouteError)?.status;
    const statusText = (error as RouteError)?.statusText;
    const message = (error as any)?.message;

    const title = status ? `Error ${status}` : "Something went wrong";
    const detail = statusText || message || "Please try again.";

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                style={{
                    maxWidth: 520,
                    width: "100%",
                    border: "1px solid rgba(0,0,0,.1)",
                    borderRadius: 12,
                    padding: 20,
                    background: "white",
                }}
            >
                <h1 style={{ margin: 0, fontSize: 20 }}>{title}</h1>
                <p style={{ marginTop: 10, color: "rgba(0,0,0,.7)" }}>{detail}</p>

                <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Link
                        to="/"
                        style={{
                            display: "inline-flex",
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "#111827",
                            color: "white",
                            textDecoration: "none",
                            fontWeight: 600,
                        }}
                    >
                        Go to Login
                    </Link>

                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            display: "inline-flex",
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "rgba(17,24,39,.08)",
                            color: "#111827",
                            border: "1px solid rgba(17,24,39,.15)",
                            cursor: "pointer",
                            fontWeight: 600,
                        }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        </div>
    );
}

