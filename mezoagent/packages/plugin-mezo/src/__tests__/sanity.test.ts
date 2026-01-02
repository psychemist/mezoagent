import { describe, it, expect } from 'bun:test';
import { mezoPlugin } from '../index';
import { swapTigrisAction } from '../actions/swapTigris';
import { depositUpshiftAction } from '../actions/depositUpshift';

describe('Mezo Plugin Sanity', () => {
    it('should export the plugin named "mezo"', () => {
        expect(mezoPlugin.name).toBe('mezo');
    });

    it('should have 4 actions', () => {
        expect(mezoPlugin.actions.length).toBe(4);
    });

    it('should include swapTigris action', () => {
        const action = mezoPlugin.actions.find(a => a.name === 'SWAP_TIGRIS');
        expect(action).toBeDefined();
        expect(action?.description).toContain('Swap tokens on Tigris DEX');
    });

    it('should include depositUpshift action', () => {
        const action = mezoPlugin.actions.find(a => a.name === 'DEPOSIT_UPSHIFT');
        expect(action).toBeDefined();
        expect(action?.description).toContain('Deposit assets into Upshift');
    });

    it('should have 4 providers', () => {
        expect(mezoPlugin.providers.length).toBe(4);
    });
});
