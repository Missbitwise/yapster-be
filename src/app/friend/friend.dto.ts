export interface SendFriendRequestDTO {
  receiverId: string;
}

export interface RespondFriendRequestDTO {
  action: "accept" | "reject";
}