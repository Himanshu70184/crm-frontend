'use client';

import { useState, useEffect } from 'react';
import { settingsAPI } from '@/lib/api';
import { COLOR_OPTIONS, slugifyColumnId } from '@/lib/kanban';
import toast from 'react-hot-toast';

export default function KanbanPhasesModal({ open, onClose, columns, onSaved }) {
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(columns.map((c, i) => ({ ...c, order: i })));
  }, [open, columns]);

  if (!open) return null;

  const updateCol = (index, field, value) => {
    setDraft((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const addPhase = () => {
    const label = 'New Phase';
    setDraft((prev) => [
      ...prev,
      { id: slugifyColumnId(`${label}_${prev.length}`), label, color: 'violet', order: prev.length, wipLimit: null },
    ]);
  };

  const removePhase = (index) => {
    if (draft.length <= 1) return toast.error('Keep at least one phase');
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const movePhase = (index, dir) => {
    const next = index + dir;
    if (next < 0 || next >= draft.length) return;
    const copy = [...draft];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    setDraft(copy.map((c, i) => ({ ...c, order: i })));
  };

  const handleSave = async () => {
    const normalized = draft.map((c, i) => ({
      id: c.id || slugifyColumnId(c.label),
      label: c.label.trim(),
      color: c.color || 'slate',
      order: i,
      wipLimit: c.wipLimit === '' || c.wipLimit == null ? null : Number(c.wipLimit),
    }));
    if (normalized.some((c) => !c.label)) return toast.error('Every phase needs a label');
    const ids = new Set(normalized.map((c) => c.id));
    if (ids.size !== normalized.length) return toast.error('Phase IDs must be unique');

    setSaving(true);
    try {
      const res = await settingsAPI.updateKanbanColumns(normalized);
      toast.success('Kanban phases updated');
      onSaved(res.data.columns);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save phases');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-premium-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-surface-200">
          <h2 className="text-lg font-bold text-surface-900">Manage Kanban phases</h2>
          <p className="text-sm text-surface-500 mt-1">Add, remove, or reorder workflow columns. Tasks in removed phases move to the first column.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {draft.map((col, index) => (
            <div key={`${col.id}-${index}`} className="flex gap-2 items-start p-3 rounded-xl bg-surface-50 border border-surface-200">
              <div className="flex flex-col gap-1 pt-2">
                <button type="button" onClick={() => movePhase(index, -1)} className="text-surface-400 hover:text-surface-700 text-xs" disabled={index === 0}>▲</button>
                <button type="button" onClick={() => movePhase(index, 1)} className="text-surface-400 hover:text-surface-700 text-xs" disabled={index === draft.length - 1}>▼</button>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-surface-500 uppercase">Label</label>
                  <input
                    className="input text-sm mt-0.5"
                    value={col.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      updateCol(index, 'label', label);
                      if (col.id.startsWith('new_phase') || col.id.startsWith('phase_')) {
                        updateCol(index, 'id', slugifyColumnId(label));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-surface-500 uppercase">Color</label>
                  <select className="input text-sm mt-0.5" value={col.color} onChange={(e) => updateCol(index, 'color', e.target.value)}>
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-surface-500 uppercase">WIP limit</label>
                  <input
                    className="input text-sm mt-0.5"
                    type="number"
                    min="0"
                    placeholder="None"
                    value={col.wipLimit ?? ''}
                    onChange={(e) => updateCol(index, 'wipLimit', e.target.value === '' ? null : e.target.value)}
                  />
                </div>
              </div>
              <button type="button" onClick={() => removePhase(index)} className="text-red-500 hover:text-red-700 text-sm p-1" title="Remove phase">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addPhase} className="w-full py-2.5 border-2 border-dashed border-surface-300 rounded-xl text-sm font-medium text-surface-600 hover:border-primary-400 hover:text-primary-600">
            + Add phase
          </button>
        </div>

        <div className="p-5 border-t border-surface-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save phases'}
          </button>
        </div>
      </div>
    </div>
  );
}
