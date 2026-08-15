import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Memory, NewMemory } from '../models/Memory';
import { AddMemoryPage } from './AddMemoryPage';

const addMemory = vi.fn<(memory: NewMemory) => Promise<Memory>>();

vi.mock('../services/memoryService', () => ({
  memoryService: {
    getMemories: () => Promise.resolve([]),
    addMemory: (memory: NewMemory) => addMemory(memory),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AddMemoryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  addMemory.mockReset();
  addMemory.mockResolvedValue({
    id: 'memory-1',
    name: 'Alex',
    message: 'A memory.',
    created: '2026-08-01T10:00:00.000Z',
  });
});

describe('AddMemoryPage', () => {
  it('reports both missing fields rather than submitting', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Add memory' }));

    expect(await screen.findByText('Please enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Please write your memory before submitting.')).toBeInTheDocument();
    expect(addMemory).not.toHaveBeenCalled();
  });

  it('marks an invalid field and moves focus to it', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Your memory'), 'A memory.');
    await user.click(screen.getByRole('button', { name: 'Add memory' }));

    const nameField = screen.getByLabelText('Your name');
    expect(nameField).toHaveAttribute('aria-invalid', 'true');
    expect(nameField).toHaveFocus();
  });

  it('clears a validation message once the visitor starts correcting the field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Add memory' }));
    expect(await screen.findByText('Please enter your name.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Your name'), 'A');

    expect(screen.queryByText('Please enter your name.')).not.toBeInTheDocument();
  });

  it('submits trimmed values through the service and confirms success', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Your name'), '  Alex  ');
    await user.type(screen.getByLabelText('Your memory'), '  A memory worth keeping.  ');
    await user.click(screen.getByRole('button', { name: 'Add memory' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Thank you — your memory has been added.',
    );
    expect(addMemory).toHaveBeenCalledWith({ name: 'Alex', message: 'A memory worth keeping.' });
    expect(screen.getByLabelText('Your name')).toHaveValue('');
  });

  it('shows a friendly message when the memory cannot be saved', async () => {
    addMemory.mockRejectedValue(new Error('network blew up'));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Your name'), 'Alex');
    await user.type(screen.getByLabelText('Your memory'), 'A memory.');
    await user.click(screen.getByRole('button', { name: 'Add memory' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your memory could not be saved');
    // The raw exception must never reach a visitor.
    expect(alert).not.toHaveTextContent('network blew up');
  });
});
