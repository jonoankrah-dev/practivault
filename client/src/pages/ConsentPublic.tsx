import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { formatDate } from "@/lib/utils-app";

export default function ConsentPublic({ token }: { token: string }) {
  const [form, setForm] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [signature, setSignature] = useState("");
  const [notes, setNotes] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetch(`/api/consent/sign/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d) => {
        setForm(d);
        setFullName(d.clients?.name || "");
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [token]);

  async function submit() {
    const res = await fetch(`/api/consent/sign/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_data: {
          full_name: fullName,
          date_of_birth: dob,
          signature,
          notes,
          signed_at_iso: new Date().toISOString(),
        },
      }),
    });
    if (res.ok) {
      setDone(true);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>;
  }
  if (error || !form) {
    return <div className="min-h-screen flex items-center justify-center text-center p-6">
      <div>
        <h1 className="text-lg font-semibold">Form not found</h1>
        <p className="text-sm text-muted-foreground mt-1">This link may have expired.</p>
      </div>
    </div>;
  }

  if (form.status === "signed" || done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-card border border-card-border rounded-xl p-8 shadow-sm text-center">
          <div className="h-12 w-12 mx-auto rounded-full bg-green-100 text-green-700 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="text-lg font-semibold">Form signed</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Thanks {form.form_data?.full_name || form.clients?.name} — we've received your signed consent form.
          </p>
          {form.signed_at && (
            <p className="text-xs text-muted-foreground mt-2">Signed on {formatDate(form.signed_at)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2.5 text-primary mb-6">
          <Logo size={28} />
          <span className="font-semibold tracking-tight text-[15px] text-foreground">FieldFlow</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-7 shadow-sm">
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Consent form
            </div>
            <h1 className="text-lg font-semibold mt-1 capitalize">
              {form.form_type.replace(/_/g, " ")}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Please review and sign below. Your signed form will be securely kept on your client file.
            </p>
          </div>

          <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-2 mb-5">
            <p>
              By signing this form you confirm that you have understood the nature of the endoPulse™
              treatment, you have had the opportunity to ask questions, and you consent to the treatment
              being carried out.
            </p>
            <p>
              You confirm that the medical history and details you provide below are accurate to the best
              of your knowledge.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date of birth</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Medical notes / allergies</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Signature (type your full name)</Label>
              <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your name to sign" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <span>I have read and agree to the terms above.</span>
            </label>

            <Button
              onClick={submit}
              disabled={!fullName || !signature || !agreed}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sign and submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
