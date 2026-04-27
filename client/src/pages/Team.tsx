import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Copy, Trash2, Shield, Stethoscope, Phone, Crown } from "lucide-react";

type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "practitioner" | "receptionist";
  status: "pending" | "active";
  invite_token: string | null;
  joined_at: string | null;
  created_at: string;
};

const ROLE_CONFIG = {
  owner: { label: "Owner", colour: "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]", icon: Crown, desc: "Full access to everything" },
  practitioner: { label: "Practitioner", colour: "bg-teal-100 text-teal-700", icon: Stethoscope, desc: "Manage own clients and bookings" },
  receptionist: { label: "Receptionist", colour: "bg-blue-100 text-blue-700", icon: Phone, desc: "View bookings, manage leads" },
};

const STATUS_CONFIG = {
  pending: { label: "Invite pending", colour: "bg-amber-100 text-amber-700" },
  active: { label: "Active", colour: "bg-green-100 text-green-700" },
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function Team() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"practitioner" | "receptionist">("practitioner");

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({ queryKey: ["/api/team"] });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/team/invite", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Invite sent" });
      setInviteOpen(false);
      setInviteName(""); setInviteEmail(""); setInviteRole("practitioner");
    },
    onError: (e: any) => toast({ title: e.message || "Failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Team member removed" });
      setDeleteId(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => apiRequest("PATCH", `/api/team/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Role updated" });
    },
  });

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/#/join/${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Invite link copied" });
  }

  const active = members.filter((m) => m.status === "active");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Team"
        subtitle="Invite practitioners and receptionists to your practice"
        action={
          <Button onClick={() => setInviteOpen(true)} data-testid="button-invite-member">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        }
      />

      {/* Role explanation cards */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <Card key={key} className="border-dashed">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <cfg.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">{cfg.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cfg.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active members */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No team members yet</p>
          <p className="text-sm mt-1">Invite practitioners and receptionists to collaborate</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Active ({active.length})</h3>
              <div className="space-y-2">
                {active.map((m) => {
                  const roleCfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.practitioner;
                  return (
                    <Card key={m.id} data-testid={`card-member-${m.id}`}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] text-sm font-semibold">
                            {initials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm" data-testid={`text-member-name-${m.id}`}>{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                        <Select
                          value={m.role}
                          onValueChange={(role) => updateRoleMutation.mutate({ id: m.id, role })}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs" data-testid={`select-role-${m.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="practitioner">Practitioner</SelectItem>
                            <SelectItem value="receptionist">Receptionist</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge className={`text-[11px] border-0 ${STATUS_CONFIG.active.colour}`}>Active</Badge>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(m.id)} data-testid={`button-remove-${m.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pending invites ({pending.length})</h3>
              <div className="space-y-2">
                {pending.map((m) => (
                  <Card key={m.id} className="border-dashed opacity-80" data-testid={`card-pending-${m.id}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <Badge className={`text-[11px] border-0 ${ROLE_CONFIG[m.role]?.colour || ""}`}>
                        {ROLE_CONFIG[m.role]?.label || m.role}
                      </Badge>
                      <Badge className="text-[11px] border-0 bg-amber-100 text-amber-700">Pending</Badge>
                      {m.invite_token && (
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => copyInviteLink(m.invite_token!)} data-testid={`button-copy-link-${m.id}`}>
                          <Copy className="h-3.5 w-3.5" /> Copy link
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(m.id)} data-testid={`button-cancel-invite-${m.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Full name *</label>
              <Input placeholder="e.g. Sarah Johnson" value={inviteName} onChange={(e) => setInviteName(e.target.value)} data-testid="input-invite-name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email address *</label>
              <Input type="email" placeholder="sarah@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="input-invite-email" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Role</label>
              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="practitioner">
                    <div>
                      <p className="font-medium">Practitioner</p>
                      <p className="text-xs text-muted-foreground">Manage own clients and bookings</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="receptionist">
                    <div>
                      <p className="font-medium">Receptionist</p>
                      <p className="text-xs text-muted-foreground">View bookings, manage leads</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5" />
              <p>An invite link will be generated. Share it with your team member — they'll join your practice when they click it.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => inviteMutation.mutate({ name: inviteName, email: inviteEmail, role: inviteRole })} disabled={inviteMutation.isPending || !inviteName || !inviteEmail} data-testid="button-send-invite">
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>They will lose access to your practice immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
