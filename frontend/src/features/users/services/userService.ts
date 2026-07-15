import api from "@/api/client";

import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
} from "../types/user";

class UserService {
  async getUsers(): Promise<User[]> {
    const response = await api.get<User[]>("/v1/users");
    return response.data;
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await api.post<User>("/v1/users", data);
    return response.data;
  }

  async updateUser(
    uuid: string,
    data: UpdateUserRequest
  ): Promise<User> {
    const response = await api.put<User>(
      `/v1/users/${uuid}`,
      data
    );
    return response.data;
  }

  async deleteUser(uuid: string): Promise<void> {
    await api.delete(`/v1/users/${uuid}`);
  }
}

const userService = new UserService();

export default userService;
