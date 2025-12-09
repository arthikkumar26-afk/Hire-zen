import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ExamSlot {
  id: string;
  slot_date: string;
  slot_start_time: string;
  slot_end_time: string;
  duration_minutes: number;
  max_candidates: number;
  booked_count: number;
  timezone: string;
}

const ExamScheduling = () => {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, ExamSlot[]>>({});
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    if (jobId) {
      loadJob();
      loadAvailableSlots();
    }
  }, [jobId]);

  const loadJob = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("position, job_description")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error: any) {
      console.error("Error loading job:", error);
    }
  };

  const loadAvailableSlots = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-available-exam-slots", {
        body: { jobId },
      });

      if (error) throw error;

      setSlots(data.slots || []);
      setSlotsByDate(data.slotsByDate || {});
    } catch (error: any) {
      console.error("Error loading slots:", error);
      toast({
        title: "Error",
        description: "Failed to load available exam slots",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookSlot = async () => {
    if (!selectedSlot || !candidateId) {
      toast({
        title: "Error",
        description: "Please select a time slot",
        variant: "destructive",
      });
      return;
    }

    setIsBooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("book-exam-slot", {
        body: {
          candidateId,
          jobId,
          examSlotId: selectedSlot,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Exam slot booked successfully. Check your email for confirmation.",
      });

      // Navigate to booking confirmation or exam page
      if (data.booking?.exam_token) {
        navigate(`/exam/${data.booking.exam_token}`);
      }
    } catch (error: any) {
      console.error("Error booking slot:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to book exam slot",
        variant: "destructive",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const getSlotsForDate = (date: Date): ExamSlot[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return slotsByDate[dateStr] || [];
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, "h:mm a");
  };

  const isSlotAvailable = (slot: ExamSlot) => {
    return slot.booked_count < slot.max_candidates;
  };

  const selectedDateSlots = selectedDate ? getSlotsForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-3xl">Schedule Your Screening Exam</CardTitle>
            <CardDescription>
              {job?.position && `For: ${job.position}`}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  return !slotsByDate[dateStr] || slotsByDate[dateStr].length === 0 || date < new Date();
                }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card>
            <CardHeader>
              <CardTitle>Available Time Slots</CardTitle>
              <CardDescription>
                {selectedDate
                  ? format(selectedDate, "EEEE, MMMM dd, yyyy")
                  : "Select a date to view available slots"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : selectedDateSlots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No available slots for this date</p>
                  <p className="text-sm mt-2">Please select another date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateSlots.map((slot) => {
                    const available = isSlotAvailable(slot);
                    return (
                      <Button
                        key={slot.id}
                        variant={selectedSlot === slot.id ? "default" : "outline"}
                        className={`w-full justify-start h-auto p-4 ${
                          !available ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() => available && setSelectedSlot(slot.id)}
                        disabled={!available}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5" />
                            <div className="text-left">
                              <div className="font-semibold">
                                {formatTime(slot.slot_start_time)} - {formatTime(slot.slot_end_time)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {slot.duration_minutes} minutes
                              </div>
                            </div>
                          </div>
                          {!available && (
                            <Badge variant="secondary">Full</Badge>
                          )}
                          {selectedSlot === slot.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Booking Summary */}
        {selectedSlot && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-semibold">{format(selectedDate, "EEEE, MMMM dd, yyyy")}</span>
                  </div>
                )}
                {selectedSlot && (
                  <>
                    {(() => {
                      const slot = selectedDateSlots.find((s) => s.id === selectedSlot);
                      if (!slot) return null;
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Time:</span>
                            <span className="font-semibold">
                              {formatTime(slot.slot_start_time)} - {formatTime(slot.slot_end_time)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="font-semibold">{slot.duration_minutes} minutes</span>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
                <div className="pt-4 border-t">
                  <Button
                    onClick={handleBookSlot}
                    disabled={isBooking}
                    className="w-full"
                    size="lg"
                  >
                    {isBooking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirm Booking
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Exam Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>You'll receive a confirmation email with exam details</li>
              <li>Please join 10 minutes early for pre-exam verification</li>
              <li>Have a valid ID ready for identity verification</li>
              <li>Ensure your camera and microphone are working</li>
              <li>Use Chrome or Edge browser for best experience</li>
              <li>Find a quiet, well-lit environment</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamScheduling;

