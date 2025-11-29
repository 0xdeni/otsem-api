# Criar Cliente Local

Endpoint para criar um novo cliente local (PF ou PJ).

## Endpoint

```
POST /customers/local
```

## Autenticação

Este endpoint requer autenticação via token JWT.

## Parâmetros (body)

```json
{
  "type": "PF",
  "name": "João da Silva",
  "email": "joao@email.com",
  "cpf": "12345678900",
  "birthday": "1990-01-01",
  "address": {
    "street": "Rua Exemplo",
    "number": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01000-000"
  }
}
```

## Exemplo de Requisição

```bash
curl -X POST https://seu-dominio.apidocumentation.com/customers/local \
  -H "Authorization: Bearer <seu_token_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PF",
    "name": "João da Silva",
    "email": "joao@email.com",
    "cpf": "12345678900",
    "birthday": "1990-01-01",
    "address": {
      "street": "Rua Exemplo",
      "number": "123",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01000-000"
    }
  }'
```

## Exemplo de Resposta

```json
{
  "id": "cus_abc123",
  "type": "PF",
  "name": "João da Silva",
  "email": "joao@email.com",
  "cpf": "12345678900",
  "birthday": "1990-01-01",
  "address": {
    "street": "Rua Exemplo",
    "number": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01000-000"
  },
  "createdAt": "2025-11-29T15:00:00Z"
}
```

---

Adicione este arquivo à pasta `docs` e referencie no menu lateral do Scalar para exibir como guia.

Se quiser exemplos para outros endpoints, só pedir!<!-- filepath: /Users/gustavo/projetos/otsem/otsem-api/docs/customer-create.md -->

# Criar Cliente Local

Endpoint para criar um novo cliente local (PF ou PJ).

## Endpoint

```
POST /customers/local
```

## Autenticação

Este endpoint requer autenticação via token JWT.

## Parâmetros (body)

```json
{
  "type": "PF",
  "name": "João da Silva",
  "email": "joao@email.com",
  "cpf": "12345678900",
  "birthday": "1990-01-01",
  "address": {
    "street": "Rua Exemplo",
    "number": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01000-000"
  }
}
```

## Exemplo de Requisição

```bash
curl -X POST https://seu-dominio.apidocumentation.com/customers/local \
  -H "Authorization: Bearer <seu_token_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PF",
    "name": "João da Silva",
    "email": "joao@email.com",
    "cpf": "12345678900",
    "birthday": "1990-01-01",
    "address": {
      "street": "Rua Exemplo",
      "number": "123",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01000-000"
    }
  }'
```

## Exemplo de Resposta

```json
{
  "id": "cus_abc123",
  "type": "PF",
  "name": "João da Silva",
  "email": "joao@email.com",
  "cpf": "12345678900",
  "birthday": "1990-01-01",
  "address": {
    "street": "Rua Exemplo",
    "number": "123",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01000-000"
  },
  "createdAt": "2025-11-29T15:00:00Z"
}
```

---
