import { Github, Hexagon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center text-center">
                    <div className="bg-primary text-primary-foreground p-3 rounded-xl mb-4">
                        <Hexagon size={40} fill="currentColor" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Sign in to your DevOps Dashboard to manage workflows
                    </p>
                </div>

                <div className="bg-card border text-card-foreground rounded-xl p-8 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4">
                        <Link
                            href="http://localhost:8000/oauth/connect"
                            target="_blank"
                            className="h-12 text-base font-medium relative overflow-hidden group inline-flex items-center justify-center whitespace-nowrap rounded-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground w-full"
                        >
                            <Github className="mr-2 h-5 w-5" />
                            Continue with GitHub
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    </div>
                </div>

                <p className="px-8 text-center text-xs text-muted-foreground">
                    By clicking continue, you agree to our{" "}
                    <Link href="#" className="underline underline-offset-4 hover:text-primary">
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="underline underline-offset-4 hover:text-primary">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
