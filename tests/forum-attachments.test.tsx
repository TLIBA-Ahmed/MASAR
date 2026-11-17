import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import i18n from '../src/i18n';
import { ToastProvider } from '../src/components/ui';
import {
  ForumAttachmentPicker,
  ForumAttachments,
  forumMaxBytes,
} from '../src/features/professional-network/ForumAttachments';

function Picker() {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <ToastProvider>
      <ForumAttachmentPicker files={files} onChange={setFiles} />
    </ToastProvider>
  );
}
beforeEach(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Pièces jointes du Forum', () => {
  it('sélectionne plusieurs documents et permet de les retirer avant publication', () => {
    render(<Picker />);
    const input = screen.getByLabelText('Joindre un document');
    fireEvent.change(input, {
      target: {
        files: [
          new File(['Ressource'], 'atelier.txt', { type: 'text/plain' }),
          new File(['%PDF'], 'guide.pdf', { type: 'application/pdf' }),
        ],
      },
    });
    expect(screen.getByText('atelier.txt')).toBeTruthy();
    expect(screen.getByText('guide.pdf')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer atelier.txt' }));
    expect(screen.queryByText('atelier.txt')).toBeNull();
    expect(screen.getByText('guide.pdf')).toBeTruthy();
  });
  it('explique les limites de taille, nombre et format dans la langue courante', async () => {
    render(<Picker />);
    const input = screen.getByLabelText('Joindre un document');
    fireEvent.change(input, {
      target: { files: [0, 1, 2, 3].map((i) => new File(['x'], `doc-${i}.txt`)) },
    });
    expect(screen.getByText('Vous pouvez joindre trois documents au maximum.')).toBeTruthy();
    const large = new File(['x'], 'large.txt');
    Object.defineProperty(large, 'size', { value: forumMaxBytes + 1 });
    fireEvent.change(input, { target: { files: [large] } });
    expect(screen.getByText('Les documents sont limités à 8 Mo au total par envoi.')).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    fireEvent.change(input, { target: { files: [new File(['x'], 'script.html')] } });
    expect(screen.getByText('الأنواع المقبولة: PDF نصي وWord DOCX وTXT.')).toBeTruthy();
  });
  it('ne télécharge rien si le serveur refuse les droits actuels', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: { code: 'RESOURCE_UNAVAILABLE' } }),
      });
    vi.stubGlobal('fetch', fetch);
    render(
      <ToastProvider>
        <ForumAttachments
          files={[{ id: 'FA-test', name: 'atelier.txt', size: 8, mediaType: 'text/plain' }]}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger atelier.txt' }));
    await waitFor(() =>
      expect(
        screen.getByText('Ce document n’est pas disponible avec vos droits actuels.'),
      ).toBeTruthy(),
    );
    expect(fetch).toHaveBeenCalledWith('/api/v1/forum/attachments/FA-test/download', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });
});
