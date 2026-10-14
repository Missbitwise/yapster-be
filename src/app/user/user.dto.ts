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

export interface UpdateUserDTO {
  name: string;
  username: string;
  bio: string;
  profile_picture?: string | null;
}
