
export interface Officer {
  id?: string;
  role: string;
  name: string;
  rank?: Rank;
}

export type Rank = string;

export const RANKS: Rank[] = [
  'JEFE DE CUERPO DE BOMBEROS',
  'SUBJEFE DE CUERPO DE BOMBEROS',
  'COMANDANTE GENERAL',
  'COMANDANTE DIRECTOR',
  'COMANDANTE',
  'SUBCOMANDANTE',
  'CAPITAN',
  'TENIENTE',
  'SUBTENIENTE',
  'BOMBERO SUPERIOR',
  'BOMBERO CALIFICADO',
  'PRINCIPAL',
  'AUXILIAR NIVEL E',
  'AUXILIAR NIVEL F',
  'AUXILIAR NIVEL G',
  'AUXILIAR NIVEL H',
  'OTRO'
];

export const rankOrder: { [key: string]: number } = {
  'JEFE DE CUERPO DE BOMBEROS': 1,
  'SUBJEFE DE CUERPO DE BOMBEROS': 2,
  'COMANDANTE GENERAL': 3,
  'COMANDANTE DIRECTOR': 4,
  'COMANDANTE': 5,
  'SUBCOMANDANTE': 6,
  'CAPITAN': 7,
  'TENIENTE': 8,
  'SUBTENIENTE': 9,
  'BOMBERO SUPERIOR': 10,
  'BOMBERO CALIFICADO': 11,
  'PRINCIPAL': 12,
  'AUXILIAR NIVEL E': 13,
  'AUXILIAR NIVEL F': 14,
  'AUXILIAR NIVEL G': 15,
  'AUXILIAR NIVEL H': 16,
  'OTRO': 17
};


export interface Personnel {
  id: string;
  name: string;
  rank: Rank;
  station?: string;
  detachment?: string;
  poc?: string;
  part?: string;
}

export interface Service {
  id: string;
  title: string;
  description?: string;
  novelty?: string;
  assignments: Assignment[];
  isHidden: boolean;
}

export interface Assignment {
  id: string;
  location: string;
  time: string;
  implementationTime?: string;
  personnel: string;
  unit?: string;
  details?: string[];
  serviceTitle?: string;
  novelty?: string;
  inService?: boolean;
  serviceEnded?: boolean;
}

export interface Schedule {
  date: string;
  commandStaff: Officer[];
  services: Service[];
  sportsEvents: Service[];
}

export interface ServiceTemplate extends Service {
  templateId: string;
}

export interface Roster {
  [date: string]: {
    jefeInspecciones?: string;
    jefeServicio?: string;
    jefeGuardia?: string;
    jefeReserva?: string;
  };
}
