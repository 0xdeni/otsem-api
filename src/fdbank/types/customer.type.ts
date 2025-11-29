export interface Customer {
    id: string;
    name: string;
    email: string;
    document: string;
    phone?: string;
    createdAt: string;
    updatedAt: string;
    // Adicione outros campos conforme resposta da API FD Bank
}