import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings, Clock, Calendar } from "lucide-react";
import TopNavBar from "@/components/layout/TopNavBar";
import Sidebar from "@/components/layout/Sidebar";

const ExamSettings = () => {
  const { id: jobId } = useParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    requiresExam: true,
    examDeadlineDays: 7,
    examDurationMinutes: 60,
  });

  useEffect(() => {
    if (jobId) {
      loadSettings();
    }
  }, [jobId]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("requires_exam, exam_deadline_days, exam_duration_minutes")
        .eq("id", jobId)
        .single();

      if (error) throw error;

      setSettings({
        requiresExam: data.requires_exam ?? true,
        examDeadlineDays: data.exam_deadline_days ?? 7,
        examDurationMinutes: data.exam_duration_minutes ?? 60,
      });
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load exam settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          requires_exam: settings.requiresExam,
          exam_deadline_days: settings.examDeadlineDays,
          exam_duration_minutes: settings.examDurationMinutes,
        })
        .eq("id", jobId);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Exam settings have been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save exam settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="ml-0 lg:ml-56 flex-1 p-4 lg:p-8">
          <div className="container mx-auto space-y-6 max-w-4xl">
            <div>
              <h1 className="text-3xl font-bold">Exam Settings</h1>
              <p className="text-muted-foreground mt-1">
                Configure on-demand exam settings for this job
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    On-Demand Exam Configuration
                  </CardTitle>
                  <CardDescription>
                    Candidates can take the exam anytime before the deadline
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Require Screening Exam</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable or disable the screening exam for this job
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.requiresExam}
                          onChange={(e) =>
                            setSettings({ ...settings, requiresExam: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {settings.requiresExam && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="deadline" className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Exam Deadline (Days)
                          </Label>
                          <Input
                            id="deadline"
                            type="number"
                            min="1"
                            max="30"
                            value={settings.examDeadlineDays}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                examDeadlineDays: parseInt(e.target.value) || 7,
                              })
                            }
                            placeholder="7"
                          />
                          <p className="text-sm text-muted-foreground">
                            Number of days after resume upload that candidates have to complete the exam
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="duration" className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Exam Duration (Minutes)
                          </Label>
                          <Input
                            id="duration"
                            type="number"
                            min="15"
                            max="180"
                            value={settings.examDurationMinutes}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                examDurationMinutes: parseInt(e.target.value) || 60,
                              })
                            }
                            placeholder="60"
                          />
                          <p className="text-sm text-muted-foreground">
                            Time limit for completing the exam once started
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      ℹ️ How It Works
                    </h3>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                      <li>Candidates receive an exam invitation email after resume upload</li>
                      <li>They can start the exam anytime before the deadline</li>
                      <li>No scheduling required - completely on-demand</li>
                      <li>Once started, they have the configured duration to complete</li>
                      <li>Videos are recorded and available for review in candidate profiles</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ExamSettings;

