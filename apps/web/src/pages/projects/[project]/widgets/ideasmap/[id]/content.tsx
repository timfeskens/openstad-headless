import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/typography";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from 'zod'

const formSchema = z.object({
    showIdeas: z.string(),
    excludeIdeas: z.string(),
    showIdeasFromTheme: z.string()
});

type Props = {
  config?: any;
  handleSubmit?: (config:any) => void
}

export default function WidgetIdeasMapContent({config, handleSubmit} :Props) {
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        showIdeas: config?.content?.showIdeas || '',
        excludeIdeas: config?.content?.excludeIdeas || '',
        showIdeasFromTheme: config?.content?.showIdeasFromTheme || ''
      },
    });
  
    function onSubmit(values: z.infer<typeof formSchema>) {
      handleSubmit && handleSubmit({content: values});
    }
  
    return (
        <div>
        <Form {...form}>
          <Heading size="xl" className="mb-4">
            Ideeën Map • Content
          </Heading>
          <Separator className="mb-4" />
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="showIdeas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Laat alleen de volgende ideeën zien (Vul hier de IDs van ideeën in, gescheiden met komma's):</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="excludeIdeas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Laat geen ideeën zien van de volgende themas (Vul hier de namen van themas in, gescheiden met komma's):</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="showIdeasFromTheme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Laat alleen ideeën zien van de volgende themas (Vul hier de namen van themas in, gescheiden met komma's):</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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