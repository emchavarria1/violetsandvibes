import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, XCircle, RefreshCw, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface AdminPanelProps {
  user: any;
}

type QueueItem = {
  userId: string;
  name: string;
  username: string | null;
  submittedAt: string;
  underReview: boolean;
  photoStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
  idStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
  photoUrl: string | null;
  idUrl: string | null;
};

type DecisionTarget = 'photo' | 'id' | 'both';
type DecisionType = 'approve' | 'reject';

const resolveFunctionErrorMessage = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    try {
      const payload = await error.context.json();
      const details =
        (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : null) ??
        (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
          ? payload.message
          : null);

      if (details) return `${details} (HTTP ${status})`;
      return `${error.message} (HTTP ${status})`;
    } catch {
      return `${error.message} (HTTP ${status})`;
    }
  }

  if (error instanceof Error) return error.message;
  return 'Could not load verification queue.';
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ user }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [decisionLoadingKey, setDecisionLoadingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const pendingPhotoCount = useMemo(
    () => queue.filter((item) => item.photoStatus === 'submitted').length,
    [queue]
  );
  const pendingIdCount = useMemo(
    () => queue.filter((item) => item.idStatus === 'submitted').length,
    [queue]
  );

  const invokeVerificationReview = async (body: Record<string, unknown>) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('No active session token found. Please sign out and sign in again.');
    }

    return supabase.functions.invoke('verification-review', {
      body: {
        ...body,
        accessToken,
      },
    });
  };

  const loadQueue = async () => {
    if (!user?.id) {
      setQueueLoading(false);
      setQueueError('Session not ready yet. Please refresh.');
      return;
    }

    setQueueLoading(true);
    setQueueError(null);

    const { data, error } = await invokeVerificationReview({ action: 'list_pending' });

    if (error) {
      const message = await resolveFunctionErrorMessage(error);
      if (message.toLowerCase().includes('admin access required')) {
        setIsAdmin(false);
        setQueue([]);
        setQueueLoading(false);
        return;
      }

      setIsAdmin(true);
      setQueueError(message);
      setQueue([]);
      setQueueLoading(false);
      return;
    }

    setIsAdmin(true);
    setQueue((data?.items ?? []) as QueueItem[]);
    setQueueLoading(false);
  };

  const handleDecision = async (
    item: QueueItem,
    target: DecisionTarget,
    decision: DecisionType
  ) => {
    const key = `${item.userId}:${target}:${decision}`;
    setDecisionLoadingKey(key);
    try {
      const { data, error } = await invokeVerificationReview({
        action: 'decide',
        targetUserId: item.userId,
        target,
        decision,
      });

      if (error) throw error;

      toast({
        title: decision === 'approve' ? 'Verification approved' : 'Verification rejected',
        description:
          data?.targetUserId === item.userId
            ? `${item.name} was updated successfully.`
            : 'Decision saved.',
      });
    } catch (error) {
      const message = await resolveFunctionErrorMessage(error);
      console.error('Failed to save verification decision:', error);
      toast({
        title: 'Decision failed',
        description: message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDecisionLoadingKey(null);
      await loadQueue();
    }
  };

  const openPreview = (url: string | null) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="wedding-title text-2xl font-bold rainbow-header">Admin Verification Queue</h1>
        <Badge variant="secondary">{queue.length} pending</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Profiles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queue.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Photo Decisions Needed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPhotoCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ID Decisions Needed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingIdCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Pending Verification Submissions</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadQueue()}
              disabled={queueLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${queueLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {queueLoading ? (
            <div className="text-sm text-muted-foreground">Loading verification queue…</div>
          ) : null}

          {queueError ? (
            <div className="text-sm text-red-600">{queueError}</div>
          ) : null}

          {!queueLoading && !queueError && queue.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending verification submissions.</div>
          ) : null}

          {queue.map((item) => {
            const approvePhotoKey = `${item.userId}:photo:approve`;
            const rejectPhotoKey = `${item.userId}:photo:reject`;
            const approveIdKey = `${item.userId}:id:approve`;
            const rejectIdKey = `${item.userId}:id:reject`;
            const approveBothKey = `${item.userId}:both:approve`;
            const rejectBothKey = `${item.userId}:both:reject`;

            return (
              <div key={item.userId} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.username ? `@${item.username}` : item.userId}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Submitted: {new Date(item.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {item.underReview ? 'Under Review' : 'Pending'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.photoStatus === 'submitted' ? 'default' : 'secondary'}>
                    Photo: {item.photoStatus}
                  </Badge>
                  <Badge variant={item.idStatus === 'submitted' ? 'default' : 'secondary'}>
                    ID: {item.idStatus}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!item.photoUrl}
                    onClick={() => openPreview(item.photoUrl)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Photo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!item.idUrl}
                    onClick={() => openPreview(item.idUrl)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    ID
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={item.photoStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'photo', 'approve')}
                  >
                    {decisionLoadingKey === approvePhotoKey ? 'Saving…' : 'Approve Photo'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={item.photoStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'photo', 'reject')}
                  >
                    {decisionLoadingKey === rejectPhotoKey ? 'Saving…' : 'Reject Photo'}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={item.idStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'id', 'approve')}
                  >
                    {decisionLoadingKey === approveIdKey ? 'Saving…' : 'Approve ID'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={item.idStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'id', 'reject')}
                  >
                    {decisionLoadingKey === rejectIdKey ? 'Saving…' : 'Reject ID'}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={
                      (item.photoStatus !== 'submitted' && item.idStatus !== 'submitted') ||
                      decisionLoadingKey !== null
                    }
                    onClick={() => void handleDecision(item, 'both', 'approve')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {decisionLoadingKey === approveBothKey ? 'Saving…' : 'Approve Both'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={
                      (item.photoStatus !== 'submitted' && item.idStatus !== 'submitted') ||
                      decisionLoadingKey !== null
                    }
                    onClick={() => void handleDecision(item, 'both', 'reject')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {decisionLoadingKey === rejectBothKey ? 'Saving…' : 'Reject Both'}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
