import { render, screen } from '@testing-library/react';
import { Card } from './card';

describe('Card', () => {
  it('renders its content', () => {
    render(
      <Card>
        <p>Heutiges Gewicht</p>
      </Card>,
    );
    expect(screen.getByText('Heutiges Gewicht')).toBeInTheDocument();
  });

  it('renders as a section when given an accessible name', () => {
    render(<Card aria-label="Gewicht">x</Card>);
    expect(screen.getByRole('region', { name: 'Gewicht' })).toBeInTheDocument();
  });

  it('drops its padding with padding="none" so children can bleed to the edge', () => {
    const { container } = render(<Card padding="none">x</Card>);
    expect(container.firstElementChild?.className).not.toMatch(/(^|\s)p-\d/);
  });

  it('lets a caller-supplied class win over the padding default', () => {
    const { container } = render(<Card className="p-6">x</Card>);
    const className = container.firstElementChild?.className ?? '';
    expect(className).toContain('p-6');
    expect(className).not.toMatch(/(^|\s)p-4(\s|$)/);
  });
});
