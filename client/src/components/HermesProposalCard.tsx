/**
 * HermesProposalCard
 * Beautiful, fully editable proposal card for Saffi chat.
 *
 * Features (matching the completed experience from our last session):
 * - Shows extracted treatment details
 * - List of proposed actions with type + JSON payload
 * - "Edit" mode: change action type (dropdown), live-edit JSON in textarea
 * - Add / Remove actions
 * - Save edits → updates the proposal in parent state
 * - Approve → calls /api/hermes/execute with the (possibly edited) proposal
 * - Clean read-only view after approval or when not editing
 */

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Edit2, Check, X, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HermesProposal, HermesAction } from "../../../server/hermes/types";

// Local action type list for the editor dropdown (matches current Hermes tools)
type HermesActionType = 
  | "complete_treatment"
  | "deduct_consumables"
  | "record_treatment_note"
  | "log_client_feedback"
  | "record_safety_observation"
  | "schedule_follow_up"
  | "create_task"
  | "create_note";

interface HermesProposalCardProps {
  proposal: HermesProposal;
  onApprove: (updatedProposal: HermesProposal) => Promise<void>;
  onReject?: () => void;
}

const ACTION_TYPES: HermesActionType[] = [
  "complete_treatment",
  "deduct_consumables",
  "record_treatment_note",
  "log_client_feedback",
  "record_safety_observation",
  "schedule_follow_up",
  "create_task",
  "create_note",
];

export function HermesProposalCard({ proposal, onApprove, onReject }: HermesProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localProposal, setLocalProposal] = useState<HermesProposal>(proposal);
  const [isApproving, setIsApproving] = useState(false);
  const [execResult, setExecResult] = useState<string | null>(null);

  const details = localProposal.extractedDetails;

  const updateAction = (index: number, updates: Partial<HermesAction>) => {
    setLocalProposal(prev => {
      const newActions = [...prev.actions];
      newActions[index] = { ...newActions[index], ...updates } as HermesAction;
      return { ...prev, actions: newActions };
    });
  };

  const changeActionType = (index: number, newType: HermesActionType) => {
    updateAction(index, { type: newType } as any);
  };

  const updatePayload = (index: number, newPayloadText: string) => {
    try {
      const parsed = JSON.parse(newPayloadText);
      updateAction(index, { payload: parsed });
    } catch {
      // keep invalid JSON in the textarea while user is typing; only save on blur or save click
    }
  };

  const addAction = () => {
    const newAction: HermesAction = {
      type: "create_note",
      payload: { title: "New action", body: "" },
      description: "Manually added by user",
    };
    setLocalProposal(prev => ({
      ...prev,
      actions: [...prev.actions, newAction],
    }));
  };

  const removeAction = (index: number) => {
    setLocalProposal(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const handleSaveEdits = () => {
    setIsEditing(false);
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(localProposal);
      setExecResult("Proposal executed successfully. Actions have been applied.");
    } catch (e: any) {
      setExecResult(`Execution failed: ${e.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = () => {
    if (onReject) onReject();
  };

  if (execResult) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-emerald-800 text-base">Hermes Proposal Executed</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-emerald-700">{execResult}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-900 text-base">Hermes Proposal — Ready for your review</CardTitle>
            <Badge variant="outline" className="text-amber-700 border-amber-300">
              {Math.round((localProposal.confidence ?? (localProposal as any).overallConfidence ?? 0.75) * 100)}% confident
            </Badge>
          </div>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-amber-700 hover:text-amber-900"
            >
              <Edit2 className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
        </div>
        <div className="text-xs text-amber-700 mt-1">
          { (localProposal as any).rawTranscript ? (
            <>Extracted from: <span className="font-mono">"{(localProposal as any).rawTranscript.slice(0, 120)}{(localProposal as any).rawTranscript.length > 120 ? "…" : ""}"</span></>
          ) : localProposal.reasoning ? (
            <>Reasoning: <span className="font-mono">{localProposal.reasoning.slice(0, 120)}{localProposal.reasoning.length > 120 ? "…" : ""}</span></>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Extracted details summary */}
        <div className="rounded-md bg-white/70 p-3 text-sm">
          <div className="font-medium text-amber-900 mb-1">What Hermes understood</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-amber-800">
            {details.clientName && <div><span className="text-amber-600">Client:</span> {details.clientName}</div>}
            {details.area && <div><span className="text-amber-600">Area:</span> {details.area}</div>}
            {details.wavelengths && <div><span className="text-amber-600">Wavelengths:</span> {details.wavelengths.join(" + ")}nm</div>}
            {details.materialsUsed && details.materialsUsed.length > 0 && (
              <div className="col-span-2">
                <span className="text-amber-600">Materials:</span>{" "}
                {details.materialsUsed.map((m: any) => `${m.quantity}× ${m.name}`).join(", ")}
              </div>
            )}
            {details.clientFeedback && <div className="col-span-2"><span className="text-amber-600">Feedback:</span> {details.clientFeedback}</div>}
          </div>
        </div>

        {/* Actions list (editable) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-amber-900">Proposed actions ({localProposal.actions.length})</div>
            {isEditing && (
              <Button variant="outline" size="sm" onClick={addAction} className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add action
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {localProposal.actions.map((action, idx) => (
              <div key={idx} className="rounded-lg border border-amber-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  {isEditing ? (
                    <Select
                      value={(action as any).type || action.type}
                      onValueChange={(v) => changeActionType(idx, v as HermesActionType)}
                    >
                      <SelectTrigger className="h-8 w-[200px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-mono text-[11px]">
                      {(action as any).type || action.type}
                    </Badge>
                  )}

                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={() => removeAction(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <Textarea
                    className="font-mono text-xs h-24"
                    defaultValue={JSON.stringify(action.payload, null, 2)}
                    onBlur={(e) => updatePayload(idx, e.target.value)}
                  />
                ) : (
                  <pre className="text-[11px] bg-amber-50 p-2 rounded overflow-auto max-h-28 text-amber-800">
                    {JSON.stringify(action.payload, null, 2)}
                  </pre>
                )}

                {action.reasoning && (
                  <div className="mt-1 text-[11px] text-amber-600 italic">“{action.reasoning}”</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-2">
        {isEditing ? (
          <>
            <Button onClick={handleSaveEdits} className="flex-1 bg-amber-600 hover:bg-amber-700">
              <Check className="h-4 w-4 mr-2" /> Save Edits
            </Button>
            <Button variant="outline" onClick={() => { setIsEditing(false); setLocalProposal(proposal); }}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isApproving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executing…</>
              ) : (
                <><Check className="h-4 w-4 mr-2" /> Approve &amp; Execute</>
              )}
            </Button>
            {onReject && (
              <Button variant="outline" onClick={handleReject}>
                <X className="h-4 w-4 mr-2" /> Dismiss
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
