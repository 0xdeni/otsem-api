// Tipos 100 % alinhados à API BRX Bank (PF e PJ)

export type AccreditationStatus =
  | 'received'
  | 'processing'
  | 'approved'
  | 'rejected';

export type Address = {
  zipCode: string;
  street: string;
  number?: string | null;
  complement?: string | null;
  neighborhood: string;
  cityIbgeCode: number;
};

/* ===== PIX LIMITS ===== */
export type PixLimits = {
  singleTransfer: number;
  daytime: number;
  nighttime: number;
  monthly: number;
  serviceId: number;
};

/* ===== PF ===== */
export type Person = {
  name: string;
  socialName?: string | null;
  cpf: string;
  birthday: string;
  phone: string;
  email: string;
  genderId?: 1 | 2 | null;
  address: Address;
};

export type AccreditationPFResponseData = {
  AccreditationId: string;
  ClientId: string;
  AccreditationStatus: AccreditationStatus;
  AccreditationStatusId: number;
  Product: string;
  ProductId: number;
  Person: {
    Name: string;
    SocialName?: string | null;
    Cpf: string;
    Birthday: string;
    Phone: string;
    Email: string;
    GenderId?: 1 | 2 | null;
    Address: {
      ZipCode: string;
      Street: string;
      Number?: string | null;
      Complement?: string | null;
      Neighborhood: string;
      CityIbgeCode: number;
    };
  };
  PixLimits: {
    SingleTransfer: number;
    Daytime?: number;
    DayTime?: number;
    Nighttime?: number;
    NightTime?: number;
    Monthly: number;
  };
};

/* ===== PJ ===== */
export type OwnershipItem = {
  name: string;
  cpf: string;
  birthday: string;
  isAdministrator: boolean;
};

export type Company = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  phone: string;
  email: string;
  address: Address;
  ownershipStructure: OwnershipItem[];
};

export type AccreditationPJResponseData = {
  AccreditationId: string;
  ClientId: string;
  AccreditationStatus: AccreditationStatus;
  AccreditationStatusId: number;
  Product: string;
  ProductId: number;
  Company: {
    LegalName: string;
    TradeName: string;
    Cnpj: string;
    Phone: string;
    Email: string;
    Address: {
      ZipCode: string;
      Street: string;
      Number?: string | null;
      Complement?: string | null;
      Neighborhood: string;
      CityIbgeCode: number;
    };
    OwnershipStructure: Array<{
      Name: string;
      Cpf: string;
      Birthday: string;
      IsAdministrator: boolean;
    }>;
  };
  PixLimits: {
    SingleTransfer: number;
    Daytime?: number;
    DayTime?: number;
    Nighttime?: number;
    NightTime?: number;
    Monthly: number;
  };
};
