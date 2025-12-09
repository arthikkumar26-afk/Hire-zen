import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExamTimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  onWarning?: (percentage: number) => void;
}

export const ExamTimer = ({ totalSeconds, onTimeUp, onWarning }: ExamTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
  const [warningsShown, setWarningsShown] = useState<Set<number>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }

        const newTime = prev - 1;
        const percentage = (newTime / totalSeconds) * 100;

        // Trigger warnings at specific percentages
        if (onWarning) {
          if (percentage <= 25 && !warningsShown.has(25)) {
            warningsShown.add(25);
            onWarning(25);
          } else if (percentage <= 10 && !warningsShown.has(10)) {
            warningsShown.add(10);
            onWarning(10);
          } else if (percentage <= 5 && !warningsShown.has(5)) {
            warningsShown.add(5);
            onWarning(5);
          } else if (newTime <= 60 && !warningsShown.has(1)) {
            warningsShown.add(1);
            onWarning(1);
          }
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [totalSeconds, onTimeUp, onWarning]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const percentage = (timeRemaining / totalSeconds) * 100;
  const isWarning = percentage <= 25;
  const isCritical = percentage <= 10;
  const isVeryCritical = percentage <= 5 || timeRemaining <= 60;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={cn(
            "h-5 w-5",
            isVeryCritical && "text-red-500 animate-pulse",
            isCritical && "text-orange-500",
            isWarning && "text-yellow-500"
          )} />
          <span className={cn(
            "text-2xl font-bold tabular-nums",
            isVeryCritical && "text-red-500",
            isCritical && "text-orange-500",
            isWarning && "text-yellow-600"
          )}>
            {formatTime(timeRemaining)}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {Math.round(percentage)}% remaining
        </span>
      </div>

      <Progress 
        value={percentage} 
        className={cn(
          "h-2",
          isVeryCritical && "bg-red-500",
          isCritical && "bg-orange-500",
          isWarning && "bg-yellow-500"
        )}
      />

      {isVeryCritical && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Less than 1 minute remaining! Submit your exam now.
          </AlertDescription>
        </Alert>
      )}
      {isCritical && !isVeryCritical && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Time running out! Please review and submit soon.
          </AlertDescription>
        </Alert>
      )}
      {isWarning && !isCritical && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have 25% time remaining. Please pace yourself accordingly.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

