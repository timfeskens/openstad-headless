import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/typography";
import { useWidgetConfig } from "@/hooks/use-widget-config";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from 'zod'

const formSchema = z.object({
    descriptionLabel: z.string(),
    descriptionInfo: z.string(),
    descriptionEditor: z.boolean(),
    descriptionRequired: z.boolean(),
  });

type FormData = z.infer<typeof formSchema>;
export default function WidgetResourceFormDescription() {
  const category = "description";

  const {
    data: widget,
    isLoading: isLoadingWidget,
    updateConfig,
  } = useWidgetConfig();

  const defaults = () => ({
    descriptionLabel: widget?.config?.[category]?.descriptionLabel || '',
    descriptionInfo: widget?.config?.[category]?.descriptionInfo || '',
    descriptionEditor: widget?.config?.[category]?.descriptionEditor || false,
    descriptionRequired: widget?.config?.[category]?.descriptionRequired || false,
  });

  async function onSubmit(values: FormData) {
    try {
      await updateConfig({ [category]: values });
    } catch (error) {
      console.error("could not update", error);
    }
  }

  const form = useForm<FormData>({
    resolver: zodResolver<any>(formSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    form.reset(defaults());
  }, [widget]);
  
    return (
        <div>
        <Form {...form}>
          <Heading size="xl" className="mb-4">
            Resource Form • Beschrijving
          </Heading>
          <Separator className="mb-4" />
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="descriptionLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label voor de beschrijving.</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descriptionInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Informatie over de beschrijving.</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descriptionEditor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Kan er gebruik gemaakt worden van een text editor?
                  </FormLabel>
                  <Select
                     onValueChange={(e: string) => field.onChange(e === "true")}
                     value={field.value ? "true" : "false"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Ja</SelectItem>
                      <SelectItem value="false">Nee</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descriptionRequired"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Is dit veld verplicht?
                  </FormLabel>
                  <Select
                     onValueChange={(e: string) => field.onChange(e === "true")}
                     value={field.value ? "true" : "false"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Nee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Ja</SelectItem>
                      <SelectItem value="false">Nee</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sticky bottom-0 py-4 bg-background border-t border-border flex flex-col">
              <Button className="self-end" type="submit">
                Opslaan
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }