import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Fish, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

const loginSchema = insertUserSchema;

export default function AuthPage() {
  const { user, loginMutation } = useAuth();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });


  // Redirect if user is already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  const onLogin = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(values);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Auth forms */}
        <Card className="w-full max-w-md mx-auto lg:mx-0">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4 mx-auto">
              <Fish className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">FishFire Management</CardTitle>
            <CardDescription>
              Sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter your username" 
                              data-testid="input-username"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Enter your password"
                              data-testid="input-password"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </Form>
                <div className="text-center text-sm text-muted-foreground space-y-1">
                  <p>Demo Credentials:</p>
                  <p className="font-medium">Username: Admin | Password: Admin</p>
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Right side - Hero section */}
        <div className="hidden lg:block text-center space-y-6">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-gray-900">
              Manage Your Fish Business
            </h2>
            <p className="text-xl text-gray-600 max-w-lg mx-auto">
              Streamline your daily operations with our comprehensive management system. 
              Track orders, manage inventory, and grow your business efficiently.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Fish className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-gray-900">Fresh Inventory</h3>
              <p className="text-sm text-gray-600">Track your seafood inventory in real-time</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Fish className="h-8 w-8 text-accent" />
              </div>
              <h3 className="font-semibold text-gray-900">Daily Orders</h3>
              <p className="text-sm text-gray-600">Process and manage customer orders</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Fish className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Analytics</h3>
              <p className="text-sm text-gray-600">Monitor your business performance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
