import type { LoanProgram } from "@/lib/types";

/** Display labels for the mortgage-loans program directory stub. */
export const PROGRAM_LABELS: Record<LoanProgram, string> = {
  FHA: "FHA Loans",
  VA: "VA Loans",
  CONVENTIONAL: "Conventional Loans",
  DSCR: "DSCR Loans",
  HELOC: "HELOC",
  REFI: "Refinance",
  JUMBO: "Jumbo Loans",
};
