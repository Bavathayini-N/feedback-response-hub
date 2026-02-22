import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, CheckCircle2, Inbox } from 'lucide-react';

interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  created_at: string;
  admin_responses: { id: string; response_text: string; status: string; created_at: string }[] | null;
}

const TraineeDashboard = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchFeedbacks = async () => {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        id, title, description, created_at,
        admin_responses(id, response_text, status, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load feedback');
    } else {
      setFeedbacks((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleSubmitFeedback = async () => {
    if (!title.trim() || !description.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('feedback').insert({
      trainee_id: user.id,
      title: title.trim(),
      description: description.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Feedback submitted!');
      setTitle('');
      setDescription('');
      setDialogOpen(false);
      fetchFeedbacks();
    }
    setSubmitting(false);
  };

  const handleAcknowledge = async (responseId: string) => {
    const { error } = await supabase
      .from('admin_responses')
      .update({ status: 'acknowledged' })
      .eq('id', responseId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Response acknowledged!');
      fetchFeedbacks();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">My Feedback</h1>
            <p className="mt-1 text-muted-foreground">Submit feedback and view admin responses</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Feedback
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Submit Feedback</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fb-title">Title</Label>
                  <Input
                    id="fb-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief summary of your feedback"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fb-desc">Description</Label>
                  <Textarea
                    id="fb-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details about your feedback..."
                    rows={5}
                  />
                </div>
                <Button
                  onClick={handleSubmitFeedback}
                  disabled={submitting || !title.trim() || !description.trim()}
                  className="w-full"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : feedbacks.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <Inbox className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No feedback yet. Submit your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((fb) => {
              const response = fb.admin_responses?.[0];
              return (
                <Card key={fb.id} className="shadow-card transition-shadow hover:shadow-card-hover">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="font-display text-lg">{fb.title}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
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

                    {response && (
                      <div className="space-y-3">
                        <div className="rounded-lg border-l-4 border-primary bg-accent/50 p-4">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Admin Response</p>
                          <p className="text-sm text-foreground">{response.response_text}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(response.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {response.status !== 'acknowledged' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleAcknowledge(response.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
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

export default TraineeDashboard;
