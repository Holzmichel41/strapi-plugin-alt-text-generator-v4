import { useState, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Dots,
  Flex,
  Grid,
  GridItem,
  IconButton,
  Loader,
  Main,
  NextLink,
  PageLink,
  Pagination,
  PreviousLink,
  Searchbar,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { Check, Cross, ExternalLink, Grid as GridIcon, List, Magic, ExclamationMarkCircle } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/helper-plugin';

import { PLUGIN_ID } from '../../pluginId';
import { getTranslation } from '../../utils/getTrad';

interface ImageAsset {
  id: number;
  name: string;
  url: string;
  formats?: {
    thumbnail?: { url: string };
    small?: { url: string };
    medium?: { url: string };
    large?: { url: string };
  };
  alternativeText?: string;
}

interface UsageData {
  used: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
}

type ImageStatus = 'idle' | 'loading' | 'success' | 'error';
type ViewMode = 'grid' | 'list';

const ProgressRing = ({
  progress,
  count,
  showCheck,
}: {
  progress: number;
  count: number;
  showCheck: boolean;
}) => {
  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <Box position="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#dcdce4"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4945ff"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <Box
        position="absolute"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {showCheck ? (
          <Check
            width={16}
            height={16}
            fill="#4945ff"
            style={{ animation: 'checkPop 0.3s ease-out' }}
          />
        ) : (
          <Typography variant="pi" fontWeight="bold" textColor="neutral800">
            {count}
          </Typography>
        )}
      </Box>
      <style>{`
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

const BulkPage = () => {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [images, setImages] = useState<ImageAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Record<number, ImageStatus>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingTotal, setGeneratingTotal] = useState(0);
  const [showCompletedCheck, setShowCompletedCheck] = useState(false);
  const [hasLicenseKey, setHasLicenseKey] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [parallelProcessingEnabled, setParallelProcessingEnabled] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [imagesRes, settingsRes] = await Promise.all([
        get('/upload/files', {
          params: {
            filters: { mime: { $startsWith: 'image/' } },
            sort: 'updatedAt:desc',
            pageSize: 100,
          },
        }),
        get(`/${PLUGIN_ID}/settings`),
      ]);
      setImages(imagesRes.data.results || []);
      setHasLicenseKey(settingsRes.data.hasLicenseKey);

      if (settingsRes.data.hasLicenseKey) {
        const [usageRes, bulkProcessingRes] = await Promise.all([
          get(`/${PLUGIN_ID}/usage`),
          get(`/${PLUGIN_ID}/bulk-processing`),
        ]);
        setUsage(usageRes.data);
        setParallelProcessingEnabled(bulkProcessingRes.data?.enabled || false);
      } else {
        setUsage(null);
        setParallelProcessingEnabled(false);
      }

      setSelectedIds(new Set());
      setStatuses({});
    } catch (error) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('bulk.fetchError') }),
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter(
      (img) =>
        img.name.toLowerCase().includes(query) || img.alternativeText?.toLowerCase().includes(query)
    );
  }, [images, searchQuery]);

  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredImages.slice(start, start + pageSize);
  }, [filteredImages, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredImages.length / pageSize);

  const handleSelectAll = () => {
    const paginatedIds = new Set(paginatedImages.map((img) => img.id));
    const allPaginatedSelected = paginatedImages.every((img) => selectedIds.has(img.id));

    if (allPaginatedSelected) {
      const newSelected = new Set(selectedIds);
      paginatedIds.forEach((id) => newSelected.delete(id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      paginatedIds.forEach((id) => newSelected.add(id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('bulk.noSelection') }),
      });
      return;
    }

    if (!hasLicenseKey) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('bulk.noLicenseKey') }),
      });
      return;
    }

    setGenerating(true);
    const ids = Array.from(selectedIds);
    setGeneratingTotal(ids.length);

    setStatuses((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = 'loading'));
      return next;
    });

    let successCount = 0;
    let usageLimitExceeded = false;
    let errorOccurred = false;

    try {
      if (parallelProcessingEnabled) {
        const chunkSize = 5;
        const chunks: number[][] = [];
        for (let i = 0; i < ids.length; i += chunkSize) {
          chunks.push(ids.slice(i, i + chunkSize));
        }

        const chunkPromises = chunks.map(async (chunk, chunkIndex) => {
          try {
            const { data } = await post(`/${PLUGIN_ID}/generate-bulk`, { fileIds: chunk });
            return { chunkIndex, results: data.results || [], error: null };
          } catch (error: unknown) {
            const errorMessage =
              error && typeof error === 'object' && 'response' in error
                ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data
                  ?.error?.message
                : '';
            return { chunkIndex, results: [], error: errorMessage || 'Request failed' };
          }
        });

        for (const promise of chunkPromises) {
          const { chunkIndex, results, error } = await promise;
          if (error) {
            if (error.includes('Usage limit exceeded')) {
              usageLimitExceeded = true;
              for (let i = chunkIndex + 1; i < chunks.length; i++) {
                setStatuses((prev) => {
                  const next = { ...prev };
                  chunks[i].forEach((id) => (next[id] = 'error'));
                  return next;
                });
              }
              break;
            }
            setStatuses((prev) => {
              const next = { ...prev };
              chunks[chunkIndex].forEach((id) => (next[id] = 'error'));
              return next;
            });
            continue;
          }

          for (const result of results) {
            const fileId = result.fileId;
            if (result.success) {
              successCount++;
              setStatuses((prev) => ({ ...prev, [fileId]: 'success' }));
              setImages((prev) =>
                prev.map((img) =>
                  img.id === fileId ? { ...img, alternativeText: result.altText } : img
                )
              );
            } else {
              if (result.error?.includes('Usage limit exceeded')) {
                usageLimitExceeded = true;
                for (let i = chunkIndex + 1; i < chunks.length; i++) {
                  setStatuses((prev) => {
                    const next = { ...prev };
                    chunks[i].forEach((id) => (next[id] = 'error'));
                    return next;
                  });
                }
                break;
              }
              setStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
            }
          }
        }
      } else {
        for (const fileId of ids) {
          try {
            const { data } = await post(`/${PLUGIN_ID}/generate-bulk`, { fileIds: [fileId] });
            const result = data.results[0];

            if (result?.success) {
              successCount++;
              setStatuses((prev) => ({ ...prev, [fileId]: 'success' }));
              setImages((prev) =>
                prev.map((img) =>
                  img.id === fileId ? { ...img, alternativeText: result.altText } : img
                )
              );
            } else {
              if (result?.error?.includes('Usage limit exceeded')) {
                usageLimitExceeded = true;
                setStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
                break;
              }
              setStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
            }
          } catch (error: unknown) {
            errorOccurred = true;
            const errorMessage =
              error && typeof error === 'object' && 'response' in error
                ? (error as { response?: { data?: { error?: { message?: string } } } }).response
                  ?.data?.error?.message
                : '';
            if (errorMessage?.includes('Usage limit exceeded')) {
              usageLimitExceeded = true;
              setStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
              break;
            }
            setStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
          }
        }
      }

      if (usageLimitExceeded) {
        setShowUpgradeDialog(true);
        try {
          const usageRes = await get(`/${PLUGIN_ID}/usage`);
          setUsage(usageRes.data);
        } catch {
          // Ignore error
        }
      }

      toggleNotification({
        type: successCount > 0 ? 'success' : errorOccurred ? 'warning' : 'info',
        message: successCount > 0
          ? formatMessage({ id: getTranslation('bulk.success') }, { count: successCount })
          : formatMessage({ id: getTranslation('bulk.error') }),
        blockTransition: true,
      });

      setShowCompletedCheck(true);
      setTimeout(() => {
        setShowCompletedCheck(false);
        setGeneratingTotal(0);
      }, 3000);
    } catch (error) {
      console.error('Error during bulk generation:', error);
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('bulk.error') }),
      });
    } finally {
      setGenerating(false);
    }
  };

  const getThumbnailUrl = (image: ImageAsset) => {
    return image.formats?.thumbnail?.url || image.formats?.small?.url || image.url;
  };

  const getGridImageUrl = (image: ImageAsset) => {
    return (
      image.formats?.medium?.url ||
      image.formats?.large?.url ||
      image.formats?.small?.url ||
      image.url
    );
  };

  const getStatusIcon = (status: ImageStatus) => {
    switch (status) {
      case 'loading':
        return <Loader small />;
      case 'success':
        return <Check fill="success600" />;
      case 'error':
        return <Cross fill="danger600" />;
      default:
        return null;
    }
  };

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
  };

  const completedCount = useMemo(() => {
    return Object.values(statuses).filter((s) => s === 'success' || s === 'error').length;
  }, [statuses]);

  const progress = generatingTotal > 0 ? (completedCount / generatingTotal) * 100 : 0;

  const isLimitReached = usage ? usage.used >= usage.limit : false;

  const handleUpgrade = async () => {
    try {
      const { data } = await post(`/${PLUGIN_ID}/customer-portal`, {
        returnUrl: window.location.href,
      });
      window.location.href = data.url;
    } catch (error) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('settings.subscription.portalError') }),
      });
      setShowUpgradeDialog(false);
    }
  };

  const renderToolbar = () => (
    <Box
      background="neutral0"
      paddingLeft={4}
      paddingRight={4}
      paddingTop={3}
      paddingBottom={3}
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      hasRadius
      width="100%"
    >
      <Flex justifyContent="space-between" alignItems="center" width="100%">
        <Flex alignItems="center" gap={4} flex="1">
          <Checkbox
            checked={paginatedImages.length > 0 && paginatedImages.every((img) => selectedIds.has(img.id))}
            indeterminate={paginatedImages.some((img) => selectedIds.has(img.id)) && !paginatedImages.every((img) => selectedIds.has(img.id))}
            onChange={() => handleSelectAll()}
          />
          <Box flex="1" maxWidth="300px">
            <Searchbar
              name="search"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              clearLabel="Clear"
            >
              Search
            </Searchbar>
          </Box>
          <Typography variant="omega" textColor="neutral600">
            {formatMessage({ id: getTranslation('bulk.selected') }, { count: selectedIds.size })}
          </Typography>
        </Flex>

        <IconButton
          label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          onClick={toggleViewMode}
        >
          {viewMode === 'grid' ? <List /> : <GridIcon />}
        </IconButton>
      </Flex>
    </Box>
  );

  const renderGridView = () => (
    <Grid>
      {paginatedImages.map((image) => (
        <GridItem col={3} s={4} xs={6} key={image.id} style={{ minWidth: 0 }}>
          <Box
            background="neutral0"
            hasRadius
            borderColor={selectedIds.has(image.id) ? 'primary600' : 'neutral200'}
            borderWidth="2px"
            borderStyle="solid"
            overflow="hidden"
            cursor="pointer"
            onClick={() => handleSelect(image.id)}
            width="100%"
          >
            <Box
              position="relative"
              width="100%"
              style={{ aspectRatio: '1 / 1' }}
              background="neutral100"
            >
              <img
                src={getGridImageUrl(image)}
                alt={image.alternativeText || image.name}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <Box
                position="absolute"
                top={2}
                left={2}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedIds.has(image.id)}
                  onChange={() => handleSelect(image.id)}
                />
              </Box>
              {statuses[image.id] && (
                <Box
                  position="absolute"
                  top={2}
                  right={2}
                  background="neutral0"
                  padding={1}
                  hasRadius
                >
                  {getStatusIcon(statuses[image.id])}
                </Box>
              )}
            </Box>
            <Box padding={2} background="neutral0" overflow="hidden">
              <Typography
                variant="pi"
                ellipsis
                textColor={image.alternativeText ? 'neutral800' : 'neutral500'}
              >
                {image.alternativeText || 'No alt text'}
              </Typography>
            </Box>
          </Box>
        </GridItem>
      ))}
    </Grid>
  );

  const renderListView = () => (
    <Table style={{ tableLayout: 'fixed', width: '100%' }}>
      <Thead>
        <Tr>
          <Th style={{ width: '48px' }}>
            <Checkbox
              checked={paginatedImages.length > 0 && paginatedImages.every((img) => selectedIds.has(img.id))}
              indeterminate={paginatedImages.some((img) => selectedIds.has(img.id)) && !paginatedImages.every((img) => selectedIds.has(img.id))}
              onChange={() => handleSelectAll()}
            />
          </Th>
          <Th style={{ width: '64px' }}>
            <Typography variant="sigma">Image</Typography>
          </Th>
          <Th style={{ width: '25%' }}>
            <Typography variant="sigma">Name</Typography>
          </Th>
          <Th>
            <Typography variant="sigma">Alt Text</Typography>
          </Th>
          <Th style={{ width: '64px' }}>
            <Typography variant="sigma">Status</Typography>
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        {paginatedImages.map((image) => (
          <Tr key={image.id} onClick={() => handleSelect(image.id)} style={{ cursor: 'pointer' }}>
            <Td
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleSelect(image.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <Box style={{ pointerEvents: 'none' }}>
                <Checkbox checked={selectedIds.has(image.id)} onChange={() => { }} />
              </Box>
            </Td>
            <Td>
              <Box
                width="40px"
                height="40px"
                borderRadius="4px"
                overflow="hidden"
                background="neutral200"
              >
                <img
                  src={getThumbnailUrl(image)}
                  alt={image.alternativeText || image.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
            </Td>
            <Td>
              <Typography variant="omega" ellipsis>
                {image.name}
              </Typography>
            </Td>
            <Td>
              <Typography
                variant="omega"
                ellipsis
                textColor={image.alternativeText ? 'neutral800' : 'neutral500'}
              >
                {image.alternativeText || 'No alt text'}
              </Typography>
            </Td>
            <Td>{statuses[image.id] && getStatusIcon(statuses[image.id])}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );

  return (
    <Main>
      <Dialog isOpen={showUpgradeDialog} onClose={() => setShowUpgradeDialog(false)}>
        <Dialog.Header>
          {formatMessage({ id: getTranslation('bulk.upgradeDialog.title') })}
        </Dialog.Header>
        <Dialog.Body>
          <Flex direction="column" alignItems="center" gap={4} padding={4}>
            <Box background="warning100" padding={3} hasRadius style={{ borderRadius: '50%' }}>
              <ExclamationMarkCircle width={32} height={32} fill="#d9822b" />
            </Box>
            <Typography variant="omega" textAlign="center">
              {formatMessage(
                { id: getTranslation('bulk.upgradeDialog.description') },
                {
                  used: usage?.used?.toLocaleString() || 0,
                  limit: usage?.limit?.toLocaleString() || 0,
                }
              )}
            </Typography>
          </Flex>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">
              {formatMessage({ id: getTranslation('bulk.upgradeDialog.cancel') })}
            </Button>
          </Dialog.Cancel>
          <Button onClick={handleUpgrade} startIcon={<ExternalLink />}>
            {formatMessage({ id: getTranslation('bulk.upgradeDialog.upgrade') })}
          </Button>
        </Dialog.Footer>
      </Dialog>

      <Box padding={8}>
        <Box paddingBottom={4}>
          <Flex justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="alpha" as="h1">
                {formatMessage({ id: getTranslation('bulk.title') })}
              </Typography>
              <Typography variant="epsilon" textColor="neutral600">
                {formatMessage({ id: getTranslation('bulk.description') })}
              </Typography>
            </Box>
            <Flex gap={3} alignItems="center">
              {selectedIds.size > 0 && !isLimitReached && (
                <ProgressRing
                  progress={generating ? progress : showCompletedCheck ? 100 : 0}
                  count={selectedIds.size}
                  showCheck={showCompletedCheck}
                />
              )}
              {isLimitReached ? (
                <Button onClick={handleUpgrade} startIcon={<ExternalLink />}>
                  {formatMessage({ id: getTranslation('settings.subscription.upgradeButton') })}
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={selectedIds.size === 0 || generating || !hasLicenseKey}
                  loading={generating}
                  startIcon={<Magic />}
                >
                  {generating
                    ? formatMessage({ id: getTranslation('bulk.generating') })
                    : formatMessage({ id: getTranslation('bulk.generate') })}
                </Button>
              )}
            </Flex>
          </Flex>
        </Box>
        {isLimitReached && (
          <Box paddingBottom={4}>
            <Box background="danger100" hasRadius>
              <Typography textColor="danger700">
                {formatMessage(
                  { id: getTranslation('bulk.limitReached') },
                  {
                    used: usage?.used?.toLocaleString() || 0,
                    limit: usage?.limit?.toLocaleString() || 0,
                  }
                )}
              </Typography>
            </Box>
          </Box>
        )}

        {!hasLicenseKey && !isLimitReached && (
          <Box paddingBottom={4}>
            <Box background="warning100" hasRadius padding={3}>
              <Typography textColor="warning700">
                {formatMessage({ id: getTranslation('bulk.noLicenseKey') })}
              </Typography>
            </Box>
          </Box>
        )}

        {loading ? (
          <Flex justifyContent="center" padding={8}>
            <Loader />
          </Flex>
        ) : images.length === 0 ? (
          <Box padding={8} textAlign="center">
            <Typography textColor="neutral600">
              {formatMessage({ id: getTranslation('bulk.noImages') })}
            </Typography>
          </Box>
        ) : (
          <Flex direction="column" gap={4}>
            {renderToolbar()}

            <Box>
              <Typography variant="sigma" textColor="neutral600">
                ASSETS ({filteredImages.length})
              </Typography>
            </Box>

            {viewMode === 'grid' ? renderGridView() : renderListView()}

            <Flex justifyContent="space-between" alignItems="center" paddingTop={4} width="100%">
              <Box>
                <SingleSelect
                  value={pageSize.toString()}
                  onChange={(value: string) => setPageSize(Number(value))}
                  size="S"
                >
                  <SingleSelectOption value="10">10</SingleSelectOption>
                  <SingleSelectOption value="20">20</SingleSelectOption>
                  <SingleSelectOption value="50">50</SingleSelectOption>
                  <SingleSelectOption value="100">100</SingleSelectOption>
                </SingleSelect>
              </Box>

              {totalPages > 1 && (
                <Box>
                  <Pagination activePage={currentPage} pageCount={totalPages}>
                    <PreviousLink onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </PreviousLink>
                    {(() => {
                      const pages: (number | 'dots')[] = [];
                      const showPages = new Set<number>();

                      showPages.add(1);
                      showPages.add(totalPages);
                      if (currentPage > 1) showPages.add(currentPage - 1);
                      showPages.add(currentPage);
                      if (currentPage < totalPages) showPages.add(currentPage + 1);

                      let lastPage = 0;
                      for (let page = 1; page <= totalPages; page++) {
                        if (showPages.has(page)) {
                          if (lastPage < page - 1) {
                            pages.push('dots');
                          }
                          pages.push(page);
                          lastPage = page;
                        }
                      }

                      return pages.map((item, index) => {
                        if (item === 'dots') {
                          return <Dots key={`dots-${index}`} />;
                        }
                        return (
                          <PageLink
                            key={item}
                            number={item}
                            onClick={() => setCurrentPage(item)}
                          >
                            {item}
                          </PageLink>
                        );
                      });
                    })()}
                    <NextLink onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                      Next
                    </NextLink>
                  </Pagination>
                </Box>
              )}
            </Flex>
          </Flex>
        )}
      </Box>
    </Main>
  );
};

export default BulkPage;
