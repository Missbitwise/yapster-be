export interface RegisterUserDTO {
  name: string;
  username: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}