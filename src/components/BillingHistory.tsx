import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Receipt, Calendar, CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeFunction } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface BillingTransaction {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  description: string;
  invoiceUrl?: string;
  paymentMethod: string;
}

const BillingHistory: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);

  const openExternal = (url: string) => {
    try {
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (popup) return true;
      window.location.assign(url);
      return true;
    } catch {
      return false;
    }
  };

  const asArray = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    return [];
  };

  const toNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };

  const normalizeStatus = (value: unknown): BillingTransaction['status'] => {
    const status = typeof value === 'string' ? value.toLowerCase() : '';
    if (status === 'pending' || status === 'failed' || status === 'refunded') return status;
    return 'paid';
  };

  const normalizeTransactions = (payload: any): BillingTransaction[] => {
    const candidateArrays = [
      asArray(payload),
      asArray(payload?.transactions),
      asArray(payload?.invoices),
      asArray(payload?.history),
      asArray(payload?.billingHistory),
    ];
    const rows = candidateArrays.find((arr) => arr.length > 0) ?? [];

    return rows
      .map((row: any, index: number) => {
        const id =
          String(
            row?.id ??
              row?.invoice_id ??
              row?.invoiceId ??
              row?.payment_intent_id ??
              `txn_${index}`
          ) || `txn_${index}`;

        const date = String(
          row?.date ??
            row?.created_at ??
            row?.createdAt ??
            row?.invoice_date ??
            new Date().toISOString()
        );

        const amountCents =
          row?.amount_cents ?? row?.amountCents ?? row?.total_cents ?? row?.totalCents;
        const amount =
          amountCents != null
            ? toNumber(amountCents) / 100
            : toNumber(row?.amount ?? row?.total ?? row?.amount_paid ?? row?.amountPaid);

        const paymentMethod =
          row?.payment_method ??
          row?.paymentMethod ??
          (row?.card_last4 ? `**** ${row.card_last4}` : 'Card');

        return {
          id,
          date,
          amount,
          status: normalizeStatus(row?.status),
          description:
            row?.description ??
            row?.plan_name ??
            row?.planName ??
            `Invoice ${id}`,
          invoiceUrl:
            row?.invoice_url ??
            row?.invoiceUrl ??
            row?.hosted_invoice_url ??
            row?.hostedInvoiceUrl ??
            undefined,
          paymentMethod,
        } as BillingTransaction;
      })
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  };

  const loadBillingHistory = async () => {
    if (!user?.id) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const actions = ['get_billing_history', 'billing_history', 'list_invoices'];
    let lastError: any = null;

    for (const action of actions) {
      const { data, error: invokeError } = await invokeEdgeFunction('handle-payment', {
        body: { action },
      });

      if (invokeError) {
        lastError = invokeError;
        continue;
      }

      const normalized = normalizeTransactions(data);
      setTransactions(normalized);
      setLoading(false);
      return;
    }

    console.warn('Could not load billing history from payment function:', lastError);
    setTransactions([]);
    setError(lastError?.message || null);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDownloadInvoice = async (transaction: BillingTransaction) => {
    if (transaction.invoiceUrl) {
      const opened = openExternal(transaction.invoiceUrl);
      if (!opened) {
        toast({
          title: 'Could not open invoice',
          description: 'Your browser blocked the invoice tab.',
          variant: 'destructive',
        });
      }
      return;
    }

    setIsDownloadingId(transaction.id);
    try {
      const actions = ['download_invoice', 'get_invoice_url'];
      let downloadUrl: string | null = null;
      let lastError: any = null;

      for (const action of actions) {
        const { data, error: invokeError } = await invokeEdgeFunction('handle-payment', {
          body: {
            action,
            invoiceId: transaction.id,
            invoice_id: transaction.id,
          },
        });

        if (invokeError) {
          lastError = invokeError;
          continue;
        }

        downloadUrl =
          data?.invoiceUrl ??
          data?.invoice_url ??
          data?.downloadUrl ??
          data?.url ??
          null;

        if (downloadUrl) break;
      }

      if (!downloadUrl) {
        throw new Error(lastError?.message || 'Invoice URL not available.');
      }

      const opened = openExternal(downloadUrl);
      if (!opened) {
        throw new Error('Your browser blocked the invoice tab.');
      }
    } catch (downloadError: any) {
      toast({
        title: 'Download failed',
        description: downloadError?.message || 'Unable to download invoice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalSpentThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return transactions
      .filter(
        (t) =>
          t.status === 'paid' && new Date(t.date).getFullYear() === currentYear
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  useEffect(() => {
    void loadBillingHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Billing History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin" />
              <p>Loading billing history…</p>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              Could not load billing history right now.
            </div>
          ) : null}

          {!loading
            ? transactions.map((transaction) => (
            <div 
              key={transaction.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {formatDate(transaction.date)}
                    </span>
                  </div>
                  <Badge className={getStatusColor(transaction.status)}>
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </Badge>
                </div>
                
                <p className="font-medium mb-1">{transaction.description}</p>
                
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    <span>{transaction.paymentMethod}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatAmount(transaction.amount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownloadInvoice(transaction)}
                  disabled={!!isDownloadingId || transaction.status === 'failed'}
                  className="flex items-center gap-1"
                >
                  {isDownloadingId === transaction.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  {isDownloadingId === transaction.id ? 'Opening...' : 'Invoice'}
                </Button>
              </div>
            </div>
          ))
            : null}

          {!loading && transactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No billing history available</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Total Spent This Year:</span>
            <span className="font-semibold text-gray-900">
              {formatAmount(totalSpentThisYear)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BillingHistory;
