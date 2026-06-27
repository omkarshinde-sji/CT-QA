/**
 * Integration Hub - Main Page
 * Category-based view of all available integrations
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, BarChart3, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProvidersGroupedByCategory } from '@/hooks/useIntegrations';
import { ProviderCard } from '@/components/integrations/ProviderCard';
import { IntegrationPreferencesSection } from '@/components/integrations/IntegrationPreferencesSection';
import {
  getCategoryIcon,
  filterProvidersByQuery,
  IntegrationProvider,
  OrganizationIntegration,
} from '@/lib/integration-utils';

export default function Integrations() {
  const navigate = useNavigate();
  const { grouped, isLoading, error } = useProvidersGroupedByCategory();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const didExpandInitially = useRef(false);

  // Expand every category once data loads (misuse of useState previously left all sections collapsed).
  useEffect(() => {
    if (!grouped?.length || didExpandInitially.current) return;
    didExpandInitially.current = true;
    setExpandedCategories(grouped.map((g) => g.category.id));
  }, [grouped]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const filteredGrouped = grouped
    ?.filter((group) => {
      // Filter by category
      if (filterCategory !== 'all' && group.category.slug !== filterCategory) {
        return false;
      }
      return true;
    })
    .map((group) => ({
      ...group,
      providers: filterProvidersByQuery(group.providers, searchQuery),
    }))
    .filter((group) => group.providers.length > 0); // Only show categories with matching providers

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-destructive">Failed to load integrations</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration Hub</h1>
          <p className="text-muted-foreground">
            Configure third-party service integrations
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/admin/integrations/analytics')}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </div>

      <IntegrationPreferencesSection />

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {grouped?.map((group) => (
              <SelectItem key={group.category.id} value={group.category.slug}>
                {group.category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Categories with Providers */}
      <div className="space-y-4">
        {filteredGrouped?.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No integrations found</p>
              {searchQuery && (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {filteredGrouped?.map((group) => {
          const CategoryIcon = getCategoryIcon(group.category.icon);
          const isExpanded = expandedCategories.includes(group.category.id);

          return (
            <Collapsible
              key={group.category.id}
              open={isExpanded}
              onOpenChange={() => toggleCategory(group.category.id)}
            >
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`h-5 w-5 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                        <CategoryIcon className="h-5 w-5" />
                        <CardTitle>{group.category.name}</CardTitle>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {group.stats.totalProviders} provider
                        {group.stats.totalProviders !== 1 ? 's' : ''}
                        {group.stats.connectedProviders > 0 &&
                          `, ${group.stats.connectedProviders} connected`}
                      </div>
                    </div>
                    <CardDescription className="text-left ml-11">
                      {group.category.description}
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {group.providers.map((provider) => (
                        <ProviderCard
                          key={provider.id}
                          provider={provider as IntegrationProvider}
                          orgIntegration={(provider as any).orgIntegration as OrganizationIntegration | undefined}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Help Text */}
      {!searchQuery && filterCategory === 'all' && (
        <Card className="border-dashed">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Need help finding an integration?</h3>
                <p className="text-sm text-muted-foreground">
                  Use the search bar to find specific providers, or filter by category to browse
                  available integrations. Click on any provider card to configure it.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
