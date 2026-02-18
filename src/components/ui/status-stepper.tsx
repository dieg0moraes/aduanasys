interface Step {
  label: string;
  status: "completed" | "current" | "pending";
}

interface StatusStepperProps {
  steps: Step[];
}

export function StatusStepper({ steps }: StatusStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            {step.status === "completed" ? (
              <div className="w-8 h-8 rounded-full bg-[#16A34A] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ) : step.status === "current" ? (
              <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-[#E4E4E7]" />
            )}
            <span className={`text-xs font-medium ${
              step.status === "current" ? "text-[#2563EB]" :
              step.status === "completed" ? "text-[#16A34A]" : "text-[#A1A1AA]"
            }`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 ${
              step.status === "completed" ? "bg-[#16A34A]" : "bg-[#E4E4E7]"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
