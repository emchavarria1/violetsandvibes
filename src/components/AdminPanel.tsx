import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, XCircle, RefreshCw, Eye, MessagesSquare } from 'lucide-react';
import { getFreshAccessToken, supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useI18n } from '@/lib/i18n';

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

type CircleSuggestionItem = {
  id: string;
  userId: string;
  name: string;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  submitterName: string;
  submitterUsername: string | null;
};

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
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CircleSuggestionItem[]>([]);
  const [decisionLoadingKey, setDecisionLoadingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;
    void loadQueue();
    void loadSuggestions();
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
  const pendingSuggestionCount = useMemo(
    () => suggestions.filter((item) => item.status === 'pending').length,
    [suggestions]
  );

  const invokeVerificationReview = async (body: Record<string, unknown>) => {
    const accessToken = await getFreshAccessToken();

    return supabase.functions.invoke('verification-review', {
      body: {
        ...body,
        accessToken,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

  const loadSuggestions = async () => {
    if (!user?.id) {
      setSuggestionsLoading(false);
      setSuggestionsError('Session not ready yet. Please refresh.');
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    const { data, error } = await supabase
      .from('circle_suggestions')
      .select('id, user_id, name, note, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.toLowerCase().includes('permission denied')) {
        setIsAdmin(false);
        setSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      setSuggestionsError(error.message || 'Could not load circle suggestions.');
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: string;
      user_id: string;
      name: string;
      note: string | null;
      status: 'pending' | 'approved' | 'rejected';
      created_at: string;
    }>;

    const userIds = Array.from(new Set(rows.map((item) => item.user_id)));
    const profileMap = new Map<string, { full_name: string | null; username: string | null }>();

    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      if (profileError) {
        console.warn('Failed to load suggestion submitter names:', profileError.message);
      } else {
        for (const row of profileRows ?? []) {
          profileMap.set(row.id, {
            full_name: row.full_name ?? null,
            username: row.username ?? null,
          });
        }
      }
    }

    setSuggestions(
      rows.map((item) => {
        const profile = profileMap.get(item.user_id);
        return {
          id: item.id,
          userId: item.user_id,
          name: item.name,
          note: item.note,
          status: item.status,
          createdAt: item.created_at,
          submitterName: profile?.full_name || profile?.username || 'Member',
          submitterUsername: profile?.username || null,
        };
      })
    );
    setSuggestionsLoading(false);
  };

  const handleSuggestionDecision = async (
    suggestion: CircleSuggestionItem,
    decision: Exclude<CircleSuggestionItem['status'], 'pending'>
  ) => {
    const key = `suggestion:${suggestion.id}:${decision}`;
    setDecisionLoadingKey(key);
    try {
      const { error } = await supabase
        .from('circle_suggestions')
        .update({
          status: decision,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', suggestion.id);

      if (error) throw error;

      toast({
        title: decision === 'approved' ? t('approve') : t('reject'),
        description:
          decision === 'approved'
            ? t('suggestionApproved', { name: suggestion.name })
            : t('suggestionRejected', { name: suggestion.name }),
      });
    } catch (error) {
      console.error('Failed to review circle suggestion:', error);
      toast({
        title: t('reviewFailed'),
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDecisionLoadingKey(null);
      await loadSuggestions();
    }
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
        title: decision === 'approve' ? t('approved') : t('rejected'),
        description:
          data?.targetUserId === item.userId
            ? t('memberUpdatedSuccessfully', { name: item.name })
            : t('decisionSaved'),
      });
    } catch (error) {
      const message = await resolveFunctionErrorMessage(error);
      console.error('Failed to save verification decision:', error);
      toast({
        title: t('decisionFailed'),
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
        <p className="text-muted-foreground">{t('adminAccessDenied')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="wedding-title text-2xl font-bold rainbow-header">{t('adminVerificationQueue')}</h1>
        <Badge variant="secondary">{queue.length} {t('pending')}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pendingProfiles')}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queue.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('photoDecisionsNeeded')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPhotoCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('idDecisionsNeeded')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingIdCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('circleSuggestions')}</CardTitle>
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSuggestionCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{t('pendingVerificationSubmissions')}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadQueue()}
              disabled={queueLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${queueLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {queueLoading ? (
            <div className="text-sm text-muted-foreground">{t('loadingVerificationQueue')}</div>
          ) : null}

          {queueError ? (
            <div className="text-sm text-red-600">{queueError}</div>
          ) : null}

          {!queueLoading && !queueError && queue.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('noPendingVerificationSubmissions')}</div>
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
                      {t('submittedAt')}: {new Date(item.submittedAt).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {item.underReview ? t('underReview') : t('pending')}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.photoStatus === 'submitted' ? 'default' : 'secondary'}>
                    {t('photoShort')}: {item.photoStatus}
                  </Badge>
                  <Badge variant={item.idStatus === 'submitted' ? 'default' : 'secondary'}>
                    {t('idShort')}: {item.idStatus}
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
                    {t('photoShort')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!item.idUrl}
                    onClick={() => openPreview(item.idUrl)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {t('idShort')}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={item.photoStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'photo', 'approve')}
                  >
                    {decisionLoadingKey === approvePhotoKey ? `${t('saving')}...` : t('approvePhoto')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={item.photoStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'photo', 'reject')}
                  >
                    {decisionLoadingKey === rejectPhotoKey ? `${t('saving')}...` : t('rejectPhoto')}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={item.idStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'id', 'approve')}
                  >
                    {decisionLoadingKey === approveIdKey ? `${t('saving')}...` : t('approveId')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={item.idStatus !== 'submitted' || decisionLoadingKey !== null}
                    onClick={() => void handleDecision(item, 'id', 'reject')}
                  >
                    {decisionLoadingKey === rejectIdKey ? `${t('saving')}...` : t('rejectId')}
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
                    {decisionLoadingKey === approveBothKey ? `${t('saving')}...` : t('approveBoth')}
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
                    {decisionLoadingKey === rejectBothKey ? `${t('saving')}...` : t('rejectBoth')}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{t('pendingCircleSuggestions')}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSuggestions()}
              disabled={suggestionsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${suggestionsLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestionsLoading ? (
            <div className="text-sm text-muted-foreground">{t('loadingCircleSuggestions')}</div>
          ) : null}

          {suggestionsError ? (
            <div className="text-sm text-red-600">{suggestionsError}</div>
          ) : null}

          {!suggestionsLoading && !suggestionsError && suggestions.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('noPendingCircleSuggestions')}</div>
          ) : null}

          {suggestions.map((item) => {
            const approveKey = `suggestion:${item.id}:approved`;
            const rejectKey = `suggestion:${item.id}:rejected`;

            return (
              <div key={item.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('submittedBy', {
                        name: item.submitterName,
                        username: item.submitterUsername ?? '',
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{t('submittedAt')}: {new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                  <Badge variant="secondary">{t('pending')}</Badge>
                </div>

                {item.note ? (
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                    {item.note}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('noModeratorNoteIncluded')}</div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={decisionLoadingKey !== null}
                    onClick={() => void handleSuggestionDecision(item, 'approved')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {decisionLoadingKey === approveKey ? `${t('saving')}...` : t('approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={decisionLoadingKey !== null}
                    onClick={() => void handleSuggestionDecision(item, 'rejected')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {decisionLoadingKey === rejectKey ? `${t('saving')}...` : t('reject')}
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
