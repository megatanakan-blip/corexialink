import { filterAndSortItems } from './src/services/searchUtils';
import type { MaterialItem } from './src/types';

const mockData: MaterialItem[] = [
    { id: '1', name: 'モルコジョイント', model: 'S', dimensions: '20', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' },
    { id: '2', name: 'モルコジョイント', model: 'AS', dimensions: '20', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' },
    { id: '3', name: 'モルコジョイント', model: 'S', dimensions: '120', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' },
    { id: '4', name: 'モルコジョイント', model: 'BS', dimensions: '20', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' },
    { id: '5', name: 'モルコジョイント', model: 'S', dimensions: '200', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' },
    { id: '6', name: 'ダミー管', model: '10', dimensions: '10', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' },
    { id: '7', name: 'ダミー管', model: '100', dimensions: '20', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' },
    { id: '8', name: 'VLP管', model: '100A', dimensions: '', category: '', unit: '', listPrice: 0, sellingPrice: 0, costPrice: 0, updatedAt: 0, quantity: 0, location: '' }
];

console.log('--- Search: モルコ S 20 ---');
const results1 = filterAndSortItems(mockData, 'モルコ S 20');
results1.forEach(r => console.log(`${r.id}: ${r.name} ${r.model} ${r.dimensions}`));

console.log('\n--- Search: 10 ---');
const results2 = filterAndSortItems(mockData, '10');
results2.forEach(r => console.log(`${r.id}: ${r.name} ${r.model} ${r.dimensions}`));
