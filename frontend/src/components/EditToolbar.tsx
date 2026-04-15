/**
 * EditToolbar — Human-action tone editing buttons for generated drafts.
 *
 * Terminology intentionally uses everyday words ("Make it Bold", "Professional")
 * instead of technical jargon ("Punchier", "Formal") to match non-marketing users.
 */
import React from 'react';
import { EditCommand } from '../services/apiService';

interface EditToolbarProps {
  isEditing: boolean;
  activeCommand: EditCommand | null;
  onEdit: (command: EditCommand) => void;
  onUndo: () => void;
  canUndo: boolean;
  disabled?: boolean;
}

const EDIT_BUTTONS: { command: EditCommand; label: string; emoji: string; description: string }[] = [
  { command: 'shorter',      label: 'Cut it Down',      emoji: '✂️', description: 'Remove the fluff, keep the point' },
  { command: 'longer',       label: 'Say More',         emoji: '✍️', description: 'Add depth and supporting ideas'  },
  { command: 'casual',       label: 'Keep it Human',    emoji: '💬', description: 'Sound like a real person'        },
  { command: 'professional', label: 'Professional',     emoji: '📋', description: 'Polish it for a formal audience' },
  { command: 'hook',         label: 'Better Opening',   emoji: '🎯', description: 'Rewrite the first line to hook'  },
  { command: 'bold',         label: 'Make it Bold',     emoji: '⚡', description: 'Punch up the language and impact'},
];

const Spinner: React.FC = () => (
  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const EditToolbar: React.FC<EditToolbarProps> = ({
  isEditing,
  activeCommand,
  onEdit,
  onUndo,
  canUndo,
  disabled,
}) => (
  <div className="neon-panel-soft px-5 py-5">
    <div className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="neon-kicker">Refine Your Draft</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          One click to reshape the tone — without losing your voice.
        </p>
      </div>
      {canUndo && (
        <button
          onClick={onUndo}
          disabled={isEditing}
          className="neon-ghost-button rounded-full px-4 py-2 text-sm font-semibold"
        >
          ↩ Undo
        </button>
      )}
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {EDIT_BUTTONS.map(({ command, label, emoji, description }) => {
        const isActive = isEditing && activeCommand === command;
        const isOtherLoading = isEditing && activeCommand !== command;
        return (
          <button
            key={command}
            onClick={() => onEdit(command)}
            disabled={disabled || isEditing}
            title={description}
            className={`neon-chip flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              isActive ? 'is-active' : ''
            } ${isOtherLoading || disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {isActive ? <Spinner /> : <span className="text-base leading-none">{emoji}</span>}
            {label}
          </button>
        );
      })}
    </div>
  </div>
);

export default EditToolbar;
