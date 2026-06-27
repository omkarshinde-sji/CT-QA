/**
 * Per-category primary integration card — pick the active sources for a
 * category and which one of them is the primary (single source of truth).
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { CategoryWithOptions } from '@/hooks/useIntegrationSettings';
import type { CategoryIntegrationPreference } from '@/lib/integration-preferences';

export interface CategoryPrimarySourceCardProps {
  category: CategoryWithOptions;
  value: CategoryIntegrationPreference;
  onChange: (value: CategoryIntegrationPreference) => void;
  disabled?: boolean;
}

export function CategoryPrimarySourceCard({
  category,
  value,
  onChange,
  disabled = false,
}: CategoryPrimarySourceCardProps) {
  const connectedOptions = category.options.filter((o) => o.connected);

  const toggleActive = (slug: string, checked: boolean) => {
    const active_slugs = checked
      ? [...value.active_slugs, slug]
      : value.active_slugs.filter((s) => s !== slug);

    const primary_slug = active_slugs.includes(value.primary_slug ?? '')
      ? value.primary_slug
      : active_slugs[0] ?? null;

    onChange({ active_slugs, primary_slug });
  };

  const setPrimary = (slug: string) => {
    onChange({ ...value, primary_slug: slug });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{category.name}</CardTitle>
        <CardDescription>
          Select which connected providers are active for {category.name.toLowerCase()}, and
          choose the primary one used as the default source of truth.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connectedOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No connected providers in this category yet. Connect one from Integrations below.
          </p>
        ) : (
          <RadioGroup
            value={value.primary_slug ?? ''}
            onValueChange={setPrimary}
            className="space-y-2"
          >
            {connectedOptions.map((option) => {
              const isActive = value.active_slugs.includes(option.slug);
              return (
                <div
                  key={option.slug}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`${category.slug}-${option.slug}-active`}
                      checked={isActive}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggleActive(option.slug, checked === true)}
                    />
                    <Label
                      htmlFor={`${category.slug}-${option.slug}-active`}
                      className="font-medium"
                    >
                      {option.name}
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value={option.slug}
                      id={`${category.slug}-${option.slug}-primary`}
                      disabled={disabled || !isActive}
                    />
                    <Label
                      htmlFor={`${category.slug}-${option.slug}-primary`}
                      className="text-xs text-muted-foreground"
                    >
                      Primary
                    </Label>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}
