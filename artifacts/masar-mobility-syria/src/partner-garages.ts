/**
 * Publish only garages that have confirmed their partnership and location.
 * This catalog is intentionally empty until verified partner details are provided.
 */
export type PartnerGarage = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  services?: string[];
  email?: string;
  website?: string;
};

export const partnerGarages: PartnerGarage[] = [];