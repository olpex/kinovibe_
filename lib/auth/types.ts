export type AuthFormState = {
  ok: boolean;
  message: string;
};

export const AUTH_FORM_INITIAL_STATE: AuthFormState = {
  ok: true,
  message: ""
};
