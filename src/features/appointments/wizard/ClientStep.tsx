'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Search, User, UserPlus, X } from 'lucide-react';
import {
  suggestExistingClients,
  type ClientSuggestion,
} from '@/features/clients/suggestion-actions';

export type ClientSelection =
  | { mode: 'existing'; client: ClientSuggestion }
  | { mode: 'new'; name: string; phone: string; email: string }
  | { mode: 'none' };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

// Step 1 of the manual booking wizard — "A dona não deve começar preenchendo três
// inputs. Primeiro deve pesquisar." Reuses suggestExistingClients (NEX-092) as the
// search backend for this step's primary purpose (finding an existing client), not just
// its original "duplicate detection while typing a new client" role — same tenant-scoped
// name-ilike/phone-eq query either way, so no new server action was needed.
export function ClientStep({
  value,
  onChange,
}: {
  value: ClientSelection;
  onChange: (value: ClientSelection) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewForm, setShowNewForm] = useState(value.mode === 'new');
  const [duplicateSuggestions, setDuplicateSuggestions] = useState<ClientSuggestion[]>([]);

  useEffect(() => {
    if (value.mode === 'existing' || showNewForm) return;
    const trimmed = query.trim();
    let cancelled = false;

    if (trimmed.length < 2) {
      // Deferred (not called synchronously in the effect body) so this stays a
      // reaction to query changing, not a render-time state write.
      const timeout = setTimeout(() => {
        if (cancelled) return;
        setResults([]);
        setSearching(false);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timeout);
      };
    }

    const timeout = setTimeout(() => {
      if (cancelled) return;
      setSearching(true);
      void (async () => {
        const result = await suggestExistingClients(trimmed, trimmed);
        if (cancelled) return;
        setResults(result.ok ? result.value : []);
        setSearching(false);
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, value.mode, showNewForm]);

  const newName = value.mode === 'new' ? value.name : '';
  const newPhone = value.mode === 'new' ? value.phone : '';
  const newEmail = value.mode === 'new' ? value.email : '';

  useEffect(() => {
    let cancelled = false;

    if (!showNewForm || (newName.trim().length < 2 && newPhone.trim().length < 3)) {
      const timeout = setTimeout(() => {
        if (!cancelled) setDuplicateSuggestions([]);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timeout);
      };
    }

    const timeout = setTimeout(() => {
      void (async () => {
        const result = await suggestExistingClients(newName, newPhone);
        if (cancelled) return;
        setDuplicateSuggestions(result.ok ? result.value : []);
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [showNewForm, newName, newPhone]);

  function selectClient(client: ClientSuggestion) {
    onChange({ mode: 'existing', client });
    setQuery('');
    setResults([]);
    setShowNewForm(false);
  }

  function startNewClient() {
    setShowNewForm(true);
    onChange({ mode: 'new', name: query.trim(), phone: '', email: '' });
  }

  function clearSelection() {
    onChange({ mode: 'none' });
    setShowNewForm(false);
    setQuery('');
  }

  if (value.mode === 'existing') {
    return (
      <div className="step-heading">
        <h2 className="step-title">Quem será atendida?</h2>
        <p className="step-description">Pesquise uma cliente existente ou crie uma nova.</p>
        <div className="selected-client-card">
          <span className="selected-client-avatar" aria-hidden="true">
            {initials(value.client.name)}
          </span>
          <span className="selected-client-info">
            <span className="selected-client-name">{value.client.name}</span>
            <span className="selected-client-phone">{value.client.phoneE164}</span>
          </span>
          <button type="button" className="selected-client-change" onClick={clearSelection}>
            Alterar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="step-heading">
      <h2 className="step-title">Quem será atendida?</h2>
      <p className="step-description">Pesquise uma cliente existente ou crie uma nova.</p>

      {!showNewForm ? (
        <>
          <div className="client-search-wrapper">
            <Search className="client-search-icon" aria-hidden="true" size={19} />
            <input
              type="text"
              className="client-search-input"
              placeholder="Pesquisar por nome ou telemóvel"
              aria-label="Pesquisar cliente"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="client-search-clear"
                aria-label="Limpar pesquisa"
                onClick={() => setQuery('')}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {query.trim().length >= 2 ? (
            searching ? (
              <p className="text-support client-search-status">A pesquisar…</p>
            ) : results.length > 0 ? (
              <ul className="client-search-results">
                {results.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      className="client-search-result"
                      onClick={() => selectClient(client)}
                    >
                      <span className="client-search-result-avatar" aria-hidden="true">
                        {initials(client.name)}
                      </span>
                      <span className="client-search-result-info">
                        <span className="client-search-result-name">{client.name}</span>
                        <span className="client-search-result-phone">{client.phoneE164}</span>
                      </span>
                      <ChevronRight
                        size={18}
                        aria-hidden="true"
                        className="client-search-result-chevron"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="client-search-empty">
                <User size={22} aria-hidden="true" />
                <p>Nenhuma cliente encontrada.</p>
                <button
                  type="button"
                  className="client-search-create-button"
                  onClick={startNewClient}
                >
                  <UserPlus size={17} aria-hidden="true" />
                  Criar nova cliente
                </button>
              </div>
            )
          ) : null}

          <button type="button" className="client-new-shortcut" onClick={startNewClient}>
            <UserPlus size={17} aria-hidden="true" />
            Criar nova cliente
          </button>
        </>
      ) : (
        <div className="new-client-form">
          <div className="new-client-form-header">
            <p className="text-eyebrow">Nova cliente</p>
            <button
              type="button"
              className="new-client-form-cancel"
              onClick={() => {
                setShowNewForm(false);
                onChange({ mode: 'none' });
              }}
            >
              Cancelar
            </button>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="new-client-name">
              Nome
            </label>
            <input
              id="new-client-name"
              className="form-input"
              value={newName}
              maxLength={120}
              onChange={(event) =>
                onChange({
                  mode: 'new',
                  name: event.target.value,
                  phone: newPhone,
                  email: newEmail,
                })
              }
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="new-client-phone">
              Telemóvel
            </label>
            <input
              id="new-client-phone"
              type="tel"
              className="form-input"
              placeholder="910 000 000"
              value={newPhone}
              onChange={(event) =>
                onChange({ mode: 'new', name: newName, phone: event.target.value, email: newEmail })
              }
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="new-client-email">
              E-mail (opcional)
            </label>
            <input
              id="new-client-email"
              type="text"
              inputMode="email"
              className="form-input"
              value={newEmail}
              onChange={(event) =>
                onChange({ mode: 'new', name: newName, phone: newPhone, email: event.target.value })
              }
            />
          </div>

          {duplicateSuggestions.length > 0 ? (
            <div className="client-suggestions" role="status">
              <p className="text-support">Já existe uma cliente parecida:</p>
              <ul className="client-search-results">
                {duplicateSuggestions.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      className="client-search-result"
                      onClick={() => selectClient(client)}
                    >
                      <span className="client-search-result-avatar" aria-hidden="true">
                        {initials(client.name)}
                      </span>
                      <span className="client-search-result-info">
                        <span className="client-search-result-name">{client.name}</span>
                        <span className="client-search-result-phone">{client.phoneE164}</span>
                      </span>
                      <ChevronRight
                        size={18}
                        aria-hidden="true"
                        className="client-search-result-chevron"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
