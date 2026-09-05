// In-memory auth token cache populated from encrypted storage on boot.
// All API calls read from this synchronously.

let _token: string | null = null
let _refreshToken: string | null = null
let _user: string | null = null

export function setToken(token: string | null) {
  _token = token
}

export function getToken(): string | null {
  return _token
}

export function setRefreshToken(token: string | null) {
  _refreshToken = token
}

export function getRefreshToken(): string | null {
  return _refreshToken
}

export function setUser(userJson: string | null) {
  _user = userJson
}

export function getUser(): string | null {
  return _user
}

export function clearAuthCache() {
  _token = null
  _refreshToken = null
  _user = null
}
