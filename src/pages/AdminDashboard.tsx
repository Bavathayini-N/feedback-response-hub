import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MessageCircle, Send, Trash2, Inbox } from 'lucide-react';

interface FeedbackRow {
  id: string;
  title: string;
  description: string;
  trainee_id: string;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
  admin_responses: { id: string; response_text: string; status: string; created_at: string }[] | null;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchFeedbacks = async () => {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        id, title, description, trainee_id, created_at,
        profiles!feedback_trainee_id_fkey(full_name, email),
        admin_responses(id, response_text, status, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load feedback');
      console.error(error);
    } else {
      setFeedbacks((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleSubmitResponse = async () => {
    if (!responseText.trim() || !selectedFeedback || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('admin_responses').insert({
      feedback_id: selectedFeedback,
      admin_id: user.id,
      response_text: responseText.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Response sent!');
      setResponseText('');
      setDialogOpen(false);
      fetchFeedbacks();
    }
    setSubmitting(false);
  };

  const handleDelete = async (responseId: string) => {
    const { error } = await supabase.from('admin_responses').delete().eq('id', responseId);
    if (error) toast.error(error.message);
    else {
      toast.success('Response deleted');
      fetchFeedbacks();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Review trainee feedback and manage responses</p>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : feedbacks.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <Inbox className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No feedback submitted yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((fb) => {
              const response = fb.admin_responses?.[0];
              const profile = fb.profiles;
              return (
                <Card key={fb.id} className="shadow-card transition-shadow hover:shadow-card-hover">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="font-display text-lg">{fb.title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          by <span className="font-medium text-foreground">{profile?.full_name || 'Unknown'}</span>
                          {' · '}
                          {new Date(fb.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {response ? (
                        <StatusBadge status={response.status} />
                      ) : (
                        <StatusBadge status="pending" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-relaxed text-foreground">{fb.description}</p>

                    {response ? (
                      <div className="rounded-lg border-l-4 border-primary bg-accent/50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Your Response</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(response.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-sm text-foreground">{response.response_text}</p>
                      </div>
                    ) : (
                      <Dialog open={dialogOpen && selectedFeedback === fb.id} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (open) setSelectedFeedback(fb.id);
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2">
                            <MessageCircle className="h-4 w-4" />
                            Write Response
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-display">Respond to: {fb.title}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Write your response to the trainee..."
                              rows={5}
                            />
                            <Button
                              onClick={handleSubmitResponse}
                              disabled={submitting || !responseText.trim()}
                              className="w-full gap-2"
                            >
                              <Send className="h-4 w-4" />
                              {submitting ? 'Sending...' : 'Send Response'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
