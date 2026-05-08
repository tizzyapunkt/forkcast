import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecipeIngredientEditor } from './recipe-ingredient-editor';
import type { RecipeIngredient } from '../../domain/recipes';

function Harness({ initial, estimateIndices }: { initial: RecipeIngredient[]; estimateIndices?: Set<number> }) {
  const [ingredients, setIngredients] = useState(initial);
  return (
    <RecipeIngredientEditor ingredients={ingredients} onChange={setIngredients} estimateIndices={estimateIndices} />
  );
}

const massOnly: RecipeIngredient = {
  name: 'Mehl',
  unit: 'g',
  macrosPerUnit: { calories: 3.4, protein: 0.1, carbs: 0.7, fat: 0.01 },
  amount: 200,
};

const pieceTracked: RecipeIngredient = {
  name: 'Zwiebel',
  unit: 'g',
  macrosPerUnit: { calories: 0.4, protein: 0.011, carbs: 0.093, fat: 0.001 },
  amount: 150,
  pieceQuantity: { amount: 1, unitLabel: 'Zwiebel', gramsPerPiece: 150 },
};

describe('RecipeIngredientEditor — piece quantities', () => {
  it('renders a piece-tracked row with both count and grams-per-piece editable', () => {
    render(<Harness initial={[pieceTracked]} />);
    const countInput = screen.getByLabelText(/stückzahl für zwiebel/i);
    const gramsInput = screen.getByLabelText(/gewicht pro stück.*zwiebel/i);
    expect(countInput).toHaveValue(1);
    expect(gramsInput).toHaveValue(150);
  });

  it('editing the piece count recomputes the mass amount', () => {
    render(<Harness initial={[pieceTracked]} />);
    const countInput = screen.getByLabelText(/stückzahl für zwiebel/i);
    fireEvent.change(countInput, { target: { value: '2' } });
    const massInput = screen.getByLabelText(/menge für zwiebel/i);
    expect(massInput).toHaveValue(300);
  });

  it('editing grams-per-piece recomputes the mass amount', () => {
    render(<Harness initial={[pieceTracked]} estimateIndices={new Set([0])} />);
    expect(screen.getByTestId('piece-estimate-0')).toBeInTheDocument();
    const gramsInput = screen.getByLabelText(/gewicht pro stück.*zwiebel/i);
    fireEvent.change(gramsInput, { target: { value: '200' } });
    const massInput = screen.getByLabelText(/menge für zwiebel/i);
    expect(massInput).toHaveValue(200);
  });

  it('editing the mass amount on a piece-tracked row prompts to detach piece info', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[pieceTracked]} />);
    const massInput = screen.getByLabelText(/menge für zwiebel/i);
    fireEvent.change(massInput, { target: { value: '120' } });
    expect(screen.getByText(/Direktes Bearbeiten/i)).toBeInTheDocument();

    const detachBtns = screen.getAllByRole('button', { name: /Stückzählung entfernen$/ });
    const confirmBtn = detachBtns.find((b) => !b.getAttribute('aria-label')) as HTMLButtonElement;
    await user.click(confirmBtn);
    expect(screen.queryByLabelText(/stückzahl für zwiebel/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/menge für zwiebel/i)).toHaveValue(120);
  });

  it('renders mass-only rows without piece UI', () => {
    render(<Harness initial={[massOnly]} />);
    expect(screen.queryByLabelText(/stückzahl/i)).not.toBeInTheDocument();
    const addPiece = screen.getByRole('button', { name: /Stückgewicht für Mehl hinterlegen/i });
    expect(addPiece).toBeInTheDocument();
  });

  it('attach-piece flow: clicking + pro Stück opens form, submit attaches pieceQuantity', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ ...massOnly, name: 'Tomate', amount: 200 }]} />);
    await user.click(screen.getByRole('button', { name: /Stückgewicht für Tomate hinterlegen/i }));
    const labelInput = screen.getByLabelText(/Bezeichnung pro Stück für Tomate/i);
    await user.type(labelInput, 'Tomate');
    await user.click(screen.getByRole('button', { name: /^OK$/ }));
    // After attach: row shows the count input
    expect(screen.getByLabelText(/Stückzahl für Tomate/i)).toBeInTheDocument();
  });
});
