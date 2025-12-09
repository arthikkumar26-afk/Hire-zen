import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Plus, Trash2, Loader2, Clock } from "lucide-react";
import { format, addDays } from "date-fns";
import TopNavBar from "@/components/layout/TopNavBar";
import Sidebar from "@/components/layout/Sidebar";

interface ExamSlot {
  id: string;
  slot_date: string;
  slot_start_time: string;
  slot_end_time: string;
  duration_minutes: number;
  max_candidates: number;
  booked_count: number;
  is_active: boolean;
}

const ExamSlotManagement = () => {
  const { id: jobId } = useParams();
  const { toast } = useToast();

  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [createForm, setCreateForm] = useState({
    startDate: new Date(),
    endDate: addDays(new Date(), 7),
    duration: 60,
    timeSlots: [9, 10, 11, 14, 15, 16],
    maxCandidatesPerSlot: 1,
  });

  useEffect(() => {
    if (jobId) {
      loadSlots();
    }
  }, [jobId]);

  const loadSlots = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("exam_slots")
        .select("*")
        .eq("job_id", jobId)
        .order("slot_date", { ascending: true })
        .order("slot_start_time", { ascending: true });

      if (error) throw error;
      setSlots(data || []);
    } catch (error: any) {
      console.error("Error loading slots:", error);
      toast({
        title: "Error",
        description: "Failed to load exam slots",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSlots = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-exam-slots", {
        body: {
          jobId,
          startDate: createForm.startDate.toISOString().split('T')[0],
          endDate: createForm.endDate.toISOString().split('T')[0],
          slotDuration: createForm.duration,
          timeSlots: createForm.timeSlots,
          maxCandidatesPerSlot: createForm.maxCandidatesPerSlot,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Created ${data.slotsCreated} exam slots`,
      });

      setShowCreateForm(false);
      loadSlots();
    } catch (error: any) {
      console.error("Error creating slots:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create exam slots",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this slot?")) return;

    try {
      const { error } = await supabase
        .from("exam_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Exam slot deleted",
      });

      loadSlots();
    } catch (error: any) {
      console.error("Error deleting slot:", error);
      toast({
        title: "Error",
        description: "Failed to delete exam slot",
        variant: "destructive",
      });
    }
  };

  const toggleSlotActive = async (slot: ExamSlot) => {
    try {
      const { error } = await supabase
        .from("exam_slots")
        .update({ is_active: !slot.is_active })
        .eq("id", slot.id);

      if (error) throw error;

      loadSlots();
    } catch (error: any) {
      console.error("Error updating slot:", error);
      toast({
        title: "Error",
        description: "Failed to update slot",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":");
    return `${parseInt(hours) % 12 || 12}:${minutes} ${parseInt(hours) >= 12 ? 'PM' : 'AM'}`;
  };

  const slotsByDate: Record<string, ExamSlot[]> = {};
  slots.forEach((slot) => {
    if (!slotsByDate[slot.slot_date]) {
      slotsByDate[slot.slot_date] = [];
    }
    slotsByDate[slot.slot_date].push(slot);
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="ml-0 lg:ml-56 flex-1 p-4 lg:p-8">
          <div className="container mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Exam Slot Management</h1>
                <p className="text-muted-foreground mt-1">
                  Create and manage exam time slots
                </p>
              </div>
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Slots
              </Button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Exam Slots</CardTitle>
                  <CardDescription>
                    Generate multiple exam slots for the selected date range
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={format(createForm.startDate, "yyyy-MM-dd")}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            startDate: new Date(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={format(createForm.endDate, "yyyy-MM-dd")}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            endDate: new Date(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        value={createForm.duration}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            duration: parseInt(e.target.value) || 60,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Candidates per Slot</Label>
                      <Input
                        type="number"
                        value={createForm.maxCandidatesPerSlot}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            maxCandidatesPerSlot: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleCreateSlots}
                      disabled={isCreating}
                      className="flex-1"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Slots
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Slots List */}
            <Card>
              <CardHeader>
                <CardTitle>Exam Slots</CardTitle>
                <CardDescription>
                  {slots.length} total slots created
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No exam slots created yet</p>
                    <p className="text-sm mt-2">Click "Create Slots" to get started</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                      <div key={date}>
                        <h3 className="font-semibold mb-3">
                          {format(new Date(date), "EEEE, MMMM dd, yyyy")}
                        </h3>
                        <div className="grid gap-3">
                          {dateSlots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex items-center gap-4">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">
                                    {formatTime(slot.slot_start_time)} -{" "}
                                    {formatTime(slot.slot_end_time)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {slot.duration_minutes} minutes •{" "}
                                    {slot.booked_count}/{slot.max_candidates} booked
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={slot.is_active ? "default" : "secondary"}
                                >
                                  {slot.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSlotActive(slot)}
                                >
                                  {slot.is_active ? "Deactivate" : "Activate"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSlot(slot.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ExamSlotManagement;

