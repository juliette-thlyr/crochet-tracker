import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { MaterialDraft, YarnLineDraft } from './logic';
import MaterialsSection from './MaterialsSection';

let latest: { yarnLines: YarnLineDraft[]; materials: MaterialDraft[] };
function Harness() {
  const [yarnLines, setYarnLines] = useState<YarnLineDraft[]>([]);
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  latest = { yarnLines, materials };
  return (
    <MaterialsSection yarnLines={yarnLines} onYarnLines={setYarnLines} materials={materials} onMaterials={setMaterials}
      yarnTypes={['Hobbii Honey Bunny']} materialNames={['Safety eyes 10 mm']} />
  );
}

test('adds a yarn line with colour, family, skeins and type, and a material', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '+ Yarn' }));
  await userEvent.type(screen.getByLabelText('Colour'), 'Pink');
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  await userEvent.type(screen.getByLabelText('Skeins'), '2');
  await userEvent.tab();
  await userEvent.type(screen.getByLabelText('Yarn type'), 'bunny');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii Honey Bunny' }));

  await userEvent.click(screen.getByRole('button', { name: '+ Material' }));
  await userEvent.type(screen.getByLabelText('Material'), 'eyes');
  await userEvent.click(screen.getByRole('option', { name: 'Safety eyes 10 mm' }));
  await userEvent.type(screen.getByLabelText('Quantity'), '2');
  await userEvent.tab();

  expect(latest.yarnLines).toEqual([{ color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: 'Hobbii Honey Bunny' }]);
  expect(latest.materials).toEqual([{ name: 'Safety eyes 10 mm', quantity: 2 }]);

  await userEvent.click(screen.getByRole('button', { name: 'Remove yarn line' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove material' }));
  expect(latest).toEqual({ yarnLines: [], materials: [] });
});

test('a yarn line with skeins needs a colour, an empty one does not', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '+ Yarn' }));
  expect(screen.getByLabelText('Colour')).not.toBeRequired();
  await userEvent.type(screen.getByLabelText('Skeins'), '2');
  await userEvent.tab();
  expect(screen.getByLabelText('Colour')).toBeRequired();
});

test('a material with a quantity needs a name', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '+ Material' }));
  expect(screen.getByLabelText('Material')).not.toBeRequired();
  await userEvent.type(screen.getByLabelText('Quantity'), '2');
  await userEvent.tab();
  expect(screen.getByLabelText('Material')).toBeRequired();
});
