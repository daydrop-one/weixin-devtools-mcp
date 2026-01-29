/**
 * Unit tests for $ tool and waitFor tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryElements, waitForCondition } from '../../src/tools.js';

describe('Page Query Tools Tests', () => {
  describe('queryElements Function Tests', () => {
    let mockPage: any;
    let mockElementMap: Map<string, string>;
    let mockElement: any;

    beforeEach(() => {
      mockElement = {
        tagName: 'view',
        text: vi.fn().mockResolvedValue('test text'),
        size: vi.fn().mockResolvedValue({ width: 100, height: 50 }),
        offset: vi.fn().mockResolvedValue({ left: 10, top: 20 }),
        attribute: vi.fn().mockImplementation((attr: string) => {
          if (attr === 'class') return Promise.resolve('test-class');
          if (attr === 'id') return Promise.resolve('test-id');
          return Promise.resolve(null);
        })
      };

      mockPage = {
        $$: vi.fn().mockResolvedValue([mockElement])
      };

      mockElementMap = new Map<string, string>();
    });

    it('should validate selector cannot be empty string', async () => {
      await expect(queryElements(mockPage, mockElementMap, { selector: '' }))
        .rejects.toThrow('Selector cannot be empty');
    });

    it('should validate selector cannot be whitespace string', async () => {
      await expect(queryElements(mockPage, mockElementMap, { selector: '   ' }))
        .rejects.toThrow('Selector cannot be empty');
    });

    it('should validate selector cannot be null', async () => {
      await expect(queryElements(mockPage, mockElementMap, { selector: null as any }))
        .rejects.toThrow('Selector cannot be empty');
    });

    it('should validate selector cannot be undefined', async () => {
      await expect(queryElements(mockPage, mockElementMap, { selector: undefined as any }))
        .rejects.toThrow('Selector cannot be empty');
    });

    it('should validate selector must be string type', async () => {
      await expect(queryElements(mockPage, mockElementMap, { selector: 123 as any }))
        .rejects.toThrow('Selector cannot be empty');
    });

    it('should validate page object is required', async () => {
      await expect(queryElements(null, mockElementMap, { selector: 'view' }))
        .rejects.toThrow('Page object is required');
    });

    it('should successfully query valid selector', async () => {
      const results = await queryElements(mockPage, mockElementMap, { selector: 'view.test' });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(expect.objectContaining({
        tagName: 'view',
        text: 'test text',
        position: expect.objectContaining({
          left: 10,
          top: 20,
          width: 100,
          height: 50
        }),
        attributes: expect.objectContaining({
          class: 'test-class',
          id: 'test-id'
        })
      }));

      expect(mockPage.$$).toHaveBeenCalledWith('view.test');
    });

    it('should handle when no elements are found', async () => {
      mockPage.$$ = vi.fn().mockResolvedValue([]);

      const results = await queryElements(mockPage, mockElementMap, { selector: 'view.nonexistent' });

      expect(results).toHaveLength(0);
    });

    it('should correctly handle element query errors', async () => {
      mockPage.$$ = vi.fn().mockRejectedValue(new Error('Query failed'));

      await expect(queryElements(mockPage, mockElementMap, { selector: 'view' }))
        .rejects.toThrow('Failed to query elements: Query failed');
    });

    it('should generate UID for queried elements and update mapping', async () => {
      const results = await queryElements(mockPage, mockElementMap, { selector: 'view.test' });

      expect(results).toHaveLength(1);
      expect(results[0].uid).toBeDefined();
      // UID generation prioritizes ID attribute, mock element has id='test-id'
      expect(results[0].uid).toBe('view#test-id');
      expect(mockElementMap.has(results[0].uid)).toBe(true);
    });

    it('should handle multiple element query results', async () => {
      const mockElement2 = {
        ...mockElement,
        attribute: vi.fn().mockImplementation((attr: string) => {
          if (attr === 'class') return Promise.resolve('test-class-2');
          if (attr === 'id') return Promise.resolve('test-id-2');
          return Promise.resolve(null);
        })
      };
      mockPage.$$ = vi.fn().mockResolvedValue([mockElement, mockElement2]);

      const results = await queryElements(mockPage, mockElementMap, { selector: 'view' });

      expect(results).toHaveLength(2);
      expect(mockElementMap.size).toBe(2);

      // Verify each element has unique UID (prioritize ID attribute)
      expect(results[0].uid).toBe('view#test-id');
      expect(results[1].uid).toBe('view#test-id-2');
    });

    it('should ignore element attribute retrieval errors', async () => {
      mockElement.attribute = vi.fn().mockRejectedValue(new Error('Attribute retrieval failed'));

      const results = await queryElements(mockPage, mockElementMap, { selector: 'view' });

      expect(results).toHaveLength(1);
      expect(results[0].attributes).toBeUndefined();
    });

    it('should ignore element position retrieval errors', async () => {
      mockElement.size = vi.fn().mockRejectedValue(new Error('Size retrieval failed'));
      mockElement.offset = vi.fn().mockRejectedValue(new Error('Position retrieval failed'));

      const results = await queryElements(mockPage, mockElementMap, { selector: 'view' });

      expect(results).toHaveLength(1);
      expect(results[0].position).toBeUndefined();
    });

    it('should ignore element text retrieval errors', async () => {
      mockElement.text = vi.fn().mockRejectedValue(new Error('Text retrieval failed'));

      const results = await queryElements(mockPage, mockElementMap, { selector: 'view' });

      expect(results).toHaveLength(1);
      expect(results[0].text).toBeUndefined();
    });
  });

  describe('waitForCondition Function Tests', () => {
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        $: vi.fn(),
        $$: vi.fn(),
        waitFor: vi.fn().mockResolvedValue(undefined)
      };
    });

    it('should support simple time delay wait', async () => {
      const result = await waitForCondition(mockPage, 1000);

      expect(result).toBe(true);
      expect(mockPage.waitFor).toHaveBeenCalledWith(1000);
    });

    it('should support selector string wait', async () => {
      const mockElement = { text: vi.fn().mockResolvedValue('') };
      mockPage.$ = vi.fn().mockResolvedValue(mockElement);

      const result = await waitForCondition(mockPage, 'view.test');

      expect(result).toBe(true);
    });

    it('should support complex wait condition object', async () => {
      const mockElement = {
        text: vi.fn().mockResolvedValue('test text'),
        size: vi.fn().mockResolvedValue({ width: 100, height: 50 })
      };
      mockPage.$ = vi.fn().mockResolvedValue(mockElement);

      const result = await waitForCondition(mockPage, {
        selector: 'view.test',
        text: 'test text',
        timeout: 3000
      });

      expect(result).toBe(true);
    });

    it('should throw error on timeout', async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null);

      await expect(waitForCondition(mockPage, {
        selector: 'view.nonexistent',
        timeout: 100  // short timeout
      })).rejects.toThrow('Wait condition failed');
    });

    it('should support visibility check', async () => {
      const mockElement = {
        size: vi.fn().mockResolvedValue({ width: 100, height: 50 })
      };
      mockPage.$ = vi.fn().mockResolvedValue(mockElement);

      const result = await waitForCondition(mockPage, {
        selector: 'view.test',
        visible: true,
        timeout: 1000
      });

      expect(result).toBe(true);
    });

    it('should support element disappear wait', async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null);

      const result = await waitForCondition(mockPage, {
        selector: 'view.test',
        disappear: true,
        timeout: 1000
      });

      expect(result).toBe(true);
    });
  });
});