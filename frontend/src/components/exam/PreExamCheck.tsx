import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Camera, Mic, Monitor, Wifi, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreExamCheckProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export const PreExamCheck = ({ onComplete, onSkip }: PreExamCheckProps) => {
  const { toast } = useToast();
  
  const [checks, setChecks] = useState({
    camera: false,
    microphone: false,
    screen: false,
    internet: false,
    browser: false,
    idReady: false,
    environment: false,
    rules: false,
  });

  const [testing, setTesting] = useState<string | null>(null);
  const [allChecksPassed, setAllChecksPassed] = useState(false);

  useEffect(() => {
    // Auto-check browser compatibility
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    setChecks((prev) => ({ ...prev, browser: isChrome || isEdge }));

    // Check internet (basic connectivity)
    setChecks((prev) => ({ ...prev, internet: navigator.onLine }));

    // Check screen size
    const hasGoodScreen = window.screen.width >= 1024 && window.screen.height >= 768;
    setChecks((prev) => ({ ...prev, screen: hasGoodScreen }));
  }, []);

  useEffect(() => {
    const allPassed = Object.values(checks).every((check) => check === true);
    setAllChecksPassed(allPassed);
  }, [checks]);

  const testCamera = async () => {
    setTesting('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setChecks((prev) => ({ ...prev, camera: true }));
      toast({
        title: "Camera Test Passed",
        description: "Your camera is working correctly.",
      });
    } catch (error) {
      setChecks((prev) => ({ ...prev, camera: false }));
      toast({
        title: "Camera Test Failed",
        description: "Please check your camera permissions and try again.",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const testMicrophone = async () => {
    setTesting('microphone');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setChecks((prev) => ({ ...prev, microphone: true }));
      toast({
        title: "Microphone Test Passed",
        description: "Your microphone is working correctly.",
      });
    } catch (error) {
      setChecks((prev) => ({ ...prev, microphone: false }));
      toast({
        title: "Microphone Test Failed",
        description: "Please check your microphone permissions and try again.",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const testScreen = async () => {
    setTesting('screen');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setChecks((prev) => ({ ...prev, screen: true }));
      toast({
        title: "Screen Share Test Passed",
        description: "Screen sharing is working correctly.",
      });
    } catch (error) {
      setChecks((prev) => ({ ...prev, screen: false }));
      toast({
        title: "Screen Share Test Failed",
        description: "Please grant screen sharing permissions.",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const CheckItem = ({ 
    icon: Icon, 
    label, 
    checked, 
    onTest, 
    testLabel,
    autoChecked = false 
  }: {
    icon: any;
    label: string;
    checked: boolean;
    onTest?: () => void;
    testLabel?: string;
    autoChecked?: boolean;
  }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <Icon className={checked ? "h-5 w-5 text-green-500" : "h-5 w-5 text-gray-400"} />
        <span className={checked ? "font-medium" : "text-muted-foreground"}>{label}</span>
        {autoChecked && checked && (
          <Badge variant="secondary" className="text-xs">Auto-detected</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {checked ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <>
            <XCircle className="h-5 w-5 text-red-500" />
            {onTest && (
              <Button
                onClick={onTest}
                disabled={testing !== null}
                variant="outline"
                size="sm"
              >
                {testing === testLabel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  testLabel || "Test"
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-Exam System Check</CardTitle>
        <CardDescription>
          Please verify all requirements before starting your exam
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Technical Requirements */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Technical Requirements
          </h3>
          
          <CheckItem
            icon={Camera}
            label="Camera Access"
            checked={checks.camera}
            onTest={testCamera}
            testLabel="Test Camera"
          />
          
          <CheckItem
            icon={Mic}
            label="Microphone Access"
            checked={checks.microphone}
            onTest={testMicrophone}
            testLabel="Test Mic"
          />
          
          <CheckItem
            icon={Monitor}
            label="Screen Sharing Permission"
            checked={checks.screen}
            onTest={testScreen}
            testLabel="Test Screen"
          />
          
          <CheckItem
            icon={Wifi}
            label="Stable Internet Connection"
            checked={checks.internet}
            autoChecked
          />
          
          <CheckItem
            icon={Monitor}
            label="Chrome or Edge Browser"
            checked={checks.browser}
            autoChecked
          />
        </div>

        {/* Preparation Checklist */}
        <div className="space-y-3 pt-4 border-t">
          <h3 className="font-semibold flex items-center gap-2">
            <Check className="h-5 w-5" />
            Preparation Checklist
          </h3>
          
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Checkbox
              id="id-ready"
              checked={checks.idReady}
              onCheckedChange={(checked) =>
                setChecks((prev) => ({ ...prev, idReady: checked as boolean }))
              }
            />
            <label
              htmlFor="id-ready"
              className="flex-1 cursor-pointer"
            >
              I have a valid government-issued ID ready for verification
            </label>
          </div>
          
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <Checkbox
              id="environment"
              checked={checks.environment}
              onCheckedChange={(checked) =>
                setChecks((prev) => ({ ...prev, environment: checked as boolean }))
              }
            />
            <label
              htmlFor="environment"
              className="flex-1 cursor-pointer"
            >
              I am in a quiet, well-lit environment with no distractions
            </label>
          </div>
        </div>

        {/* Rules Agreement */}
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="space-y-3">
            <div className="font-semibold text-yellow-900 dark:text-yellow-100">
              Exam Rules & Guidelines
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
              <li>Do not switch browser tabs or windows during the exam</li>
              <li>Do not use any external resources, books, or help</li>
              <li>Do not communicate with anyone during the exam</li>
              <li>Keep your face visible to the camera at all times</li>
              <li>Ensure no one else is in the room</li>
              <li>The exam session is being recorded for integrity purposes</li>
            </ul>
            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="rules"
                checked={checks.rules}
                onCheckedChange={(checked) =>
                  setChecks((prev) => ({ ...prev, rules: checked as boolean }))
                }
              />
              <label
                htmlFor="rules"
                className="flex-1 cursor-pointer text-sm font-medium text-yellow-900 dark:text-yellow-100"
              >
                I understand and agree to follow all exam rules and guidelines
              </label>
            </div>
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {onSkip && (
            <Button
              variant="outline"
              onClick={onSkip}
              className="flex-1"
            >
              Skip Checks
            </Button>
          )}
          <Button
            onClick={onComplete}
            disabled={!allChecksPassed || testing !== null}
            className="flex-1"
          >
            {allChecksPassed ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                All Checks Passed - Start Exam
              </>
            ) : (
              "Complete All Checks to Continue"
            )}
          </Button>
        </div>

        {!allChecksPassed && (
          <div className="text-sm text-muted-foreground text-center">
            Please complete all checks above to proceed with the exam
          </div>
        )}
      </CardContent>
    </Card>
  );
};

