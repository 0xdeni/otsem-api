import {
  validateCPF,
  validateCNPJ,
  cleanDocument,
  validateDocument,
} from './document-validator';

describe('Document Validator', () => {
  describe('cleanDocument', () => {
    it('should remove dots, dashes and slashes', () => {
      expect(cleanDocument('123.456.789-01')).toBe('12345678901');
      expect(cleanDocument('12.345.678/0001-95')).toBe('12345678000195');
    });

    it('should return same string if already clean', () => {
      expect(cleanDocument('12345678901')).toBe('12345678901');
    });
  });

  describe('validateCPF', () => {
    it('should validate a correct CPF', () => {
      expect(validateCPF('52998224725')).toBe(true);
    });

    it('should reject CPF with wrong length', () => {
      expect(validateCPF('1234')).toBe(false);
      expect(validateCPF('123456789012')).toBe(false);
    });

    it('should reject CPF with all same digits', () => {
      expect(validateCPF('11111111111')).toBe(false);
      expect(validateCPF('00000000000')).toBe(false);
      expect(validateCPF('99999999999')).toBe(false);
    });

    it('should reject CPF with invalid check digits', () => {
      expect(validateCPF('52998224726')).toBe(false);
      expect(validateCPF('12345678900')).toBe(false);
    });

    it('should handle formatted CPF', () => {
      expect(validateCPF('529.982.247-25')).toBe(true);
    });
  });

  describe('validateCNPJ', () => {
    it('should validate a correct CNPJ', () => {
      expect(validateCNPJ('11222333000181')).toBe(true);
    });

    it('should reject CNPJ with wrong length', () => {
      expect(validateCNPJ('1234')).toBe(false);
      expect(validateCNPJ('123456789012345')).toBe(false);
    });

    it('should reject CNPJ with all same digits', () => {
      expect(validateCNPJ('11111111111111')).toBe(false);
      expect(validateCNPJ('00000000000000')).toBe(false);
    });

    it('should reject CNPJ with invalid check digits', () => {
      expect(validateCNPJ('11222333000182')).toBe(false);
    });

    it('should handle formatted CNPJ', () => {
      expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
    });
  });

  describe('validateDocument', () => {
    it('should validate CPF (11 digits)', () => {
      expect(validateDocument('52998224725')).toBe(true);
    });

    it('should validate CNPJ (14 digits)', () => {
      expect(validateDocument('11222333000181')).toBe(true);
    });

    it('should reject documents with invalid length', () => {
      expect(validateDocument('1234567')).toBe(false);
      expect(validateDocument('1234567890123456')).toBe(false);
    });

    it('should handle formatted documents', () => {
      expect(validateDocument('529.982.247-25')).toBe(true);
      expect(validateDocument('11.222.333/0001-81')).toBe(true);
    });
  });
});
