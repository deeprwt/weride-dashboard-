import type { AuthClient } from './auth';

export type SavedPlaceKind = 'home' | 'work' | 'other';

export interface SavedPlace {
  id: string;
  kind: SavedPlaceKind;
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export interface SavedPlaceInput {
  kind: SavedPlaceKind;
  name: string;
  address: string;
  location: { lat: number; lng: number };
}

/**
 * Saved places — the hearts in the rider's search screen. Layered on AuthClient
 * so every call inherits refresh-on-401. Saving a `home` or `work` replaces the
 * existing one server-side.
 */
export class PlacesClient {
  constructor(private readonly auth: AuthClient) {}

  async list(): Promise<SavedPlace[]> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<SavedPlace[]>('/v1/me/places'),
    );
  }

  async save(input: SavedPlaceInput): Promise<SavedPlace> {
    return this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<SavedPlace>('/v1/me/places', { method: 'POST', body: input }),
    );
  }

  async remove(id: string): Promise<void> {
    await this.auth.withAutoRefresh(() =>
      this.auth.rawClient.request<void>(`/v1/me/places/${id}`, { method: 'DELETE' }),
    );
  }
}
