export type Role = 'user' | 'admin'
export type AccountStatus = 'active' | 'disabled'

export interface Profile {
  id: string
  email: string
  display_name: string
  role: Role
  status: AccountStatus
  must_change_password: boolean
  name_confirmed: boolean
  created_at: string
}

export interface Player {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface Match {
  id: string
  player_a_id: string
  player_b_id: string
  player_a_score: number
  player_b_score: number
  match_date: string
  created_by: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
  player_a: { name: string } | null
  player_b: { name: string } | null
  recorder: { display_name: string } | null
  editor: { display_name: string } | null
}

export interface PlayerStats {
  player_id: string
  name: string
  active: boolean
  created_at: string
  games_played: number
  wins: number
  losses: number
  points_scored: number
  points_conceded: number
  point_difference: number
  rank: number | null
}

export interface Invite {
  email: string
  role: Role
  invited_by: string | null
  created_at: string
  accepted_at: string | null
}

export interface AppSettings {
  league_name: string
}

/** Columns + joins used everywhere a match is displayed. */
export const MATCH_SELECT =
  '*, player_a:players!player_a_id(name), player_b:players!player_b_id(name), recorder:profiles!created_by(display_name), editor:profiles!updated_by(display_name)'
