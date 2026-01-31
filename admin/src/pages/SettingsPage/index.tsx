import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Main,
  TextInput,
  Typography,
  ToggleInput,
  Loader,
} from '@strapi/design-system';
import { Check, Pencil, Key, ExternalLink, Lock, Rocket, Magic } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/helper-plugin';

import { PLUGIN_ID } from '../../pluginId';
import { getTranslation } from '../../utils/getTrad';

interface SubscriptionData {
  hasSubscription: boolean;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  status: string | null;
  planName: string | null;
  currentPeriodEnd: number | null;
}

interface PricingData {
  pricingUrl: string;
  dashboardUrl: string;
  hasLicenseKey: boolean;
}

interface UsageData {
  used: number;
  limit: number;
  periodStart: string;
  periodEnd: string;
}

interface AutoTaggingData {
  enabled: boolean;
  available: boolean;
}

interface BulkProcessingData {
  enabled: boolean;
  available: boolean;
}

const SettingsPage = () => {
  const { formatMessage } = useIntl();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const location = useLocation();

  const [licenseKey, setLicenseKey] = useState('');
  const [hasLicenseKey, setHasLicenseKey] = useState(false);
  const [isEditingLicense, setIsEditingLicense] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [autoTagging, setAutoTagging] = useState<AutoTaggingData | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState<BulkProcessingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLicense, setSavingLicense] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [autoTaggingSaving, setAutoTaggingSaving] = useState(false);
  const [bulkProcessingSaving, setBulkProcessingSaving] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!hasLicenseKey) return;
    try {
      const [subscriptionRes, usageRes, autoTaggingRes, bulkProcessingRes] = await Promise.all([
        get(`/${PLUGIN_ID}/subscription`),
        get(`/${PLUGIN_ID}/usage`),
        get(`/${PLUGIN_ID}/auto-tagging`),
        get(`/${PLUGIN_ID}/bulk-processing`),
      ]);
      setSubscription(subscriptionRes.data || null);
      setUsage(usageRes.data || null);
      setAutoTagging(autoTaggingRes.data || { enabled: false, available: false });
      setBulkProcessing(bulkProcessingRes.data || { enabled: false, available: false });
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
      setSubscription(null);
      setUsage(null);
      setAutoTagging({ enabled: false, available: false });
      setBulkProcessing({ enabled: false, available: false });
    }
  }, [hasLicenseKey, get]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, pricingRes] = await Promise.all([
        get(`/${PLUGIN_ID}/settings`),
        get(`/${PLUGIN_ID}/pricing-info`),
      ]);
      setHasLicenseKey(settingsRes.data?.hasLicenseKey || false);
      setPricingData(pricingRes.data || { pricingUrl: '', dashboardUrl: '', hasLicenseKey: false });

      if (settingsRes.data?.hasLicenseKey) {
        try {
          const [subscriptionRes, usageRes, autoTaggingRes, bulkProcessingRes] = await Promise.all([
            get(`/${PLUGIN_ID}/subscription`),
            get(`/${PLUGIN_ID}/usage`),
            get(`/${PLUGIN_ID}/auto-tagging`),
            get(`/${PLUGIN_ID}/bulk-processing`),
          ]);
          setSubscription(subscriptionRes.data || null);
          setUsage(usageRes.data || null);
          setAutoTagging(autoTaggingRes.data || { enabled: false, available: false });
          setBulkProcessing(bulkProcessingRes.data || { enabled: false, available: false });
        } catch (subError) {
          console.error('Failed to fetch subscription data:', subError);
          setSubscription(null);
          setUsage(null);
          setAutoTagging({ enabled: false, available: false });
          setBulkProcessing({ enabled: false, available: false });
        }
      } else {
        setSubscription(null);
        setUsage(null);
        setAutoTagging({ enabled: false, available: false });
        setBulkProcessing({ enabled: false, available: false });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('settings.fetch.error') }),
      });
      setHasLicenseKey(false);
      setPricingData({ pricingUrl: '', dashboardUrl: '', hasLicenseKey: false });
      setSubscription(null);
      setUsage(null);
      setAutoTagging({ enabled: false, available: false });
      setBulkProcessing({ enabled: false, available: false });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLicenseKey = async () => {
    if (!licenseKey.trim()) return;

    setSavingLicense(true);
    try {
      await post(`/${PLUGIN_ID}/license-key`, { licenseKey: licenseKey.trim() });
      setHasLicenseKey(true);
      setLicenseKey('');
      setIsEditingLicense(false);
      toggleNotification({
        type: 'success',
        message: formatMessage({ id: getTranslation('settings.licenseKey.save.success') }),
      });

      const [pricingRes, subscriptionRes, usageRes, autoTaggingRes, bulkProcessingRes] = await Promise.all([
        get(`/${PLUGIN_ID}/pricing-info`),
        get(`/${PLUGIN_ID}/subscription`),
        get(`/${PLUGIN_ID}/usage`),
        get(`/${PLUGIN_ID}/auto-tagging`),
        get(`/${PLUGIN_ID}/bulk-processing`),
      ]);

      setPricingData(pricingRes.data || { pricingUrl: '', dashboardUrl: '', hasLicenseKey: true });
      setSubscription(subscriptionRes.data || null);
      setUsage(usageRes.data || null);
      setAutoTagging(autoTaggingRes.data || { enabled: false, available: false });
      setBulkProcessing(bulkProcessingRes.data || { enabled: false, available: false });
    } catch (error) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('settings.licenseKey.save.error') }),
      });
    } finally {
      setSavingLicense(false);
    }
  };

  const handleEditLicenseKey = async () => {
    try {
      const { data } = await get(`/${PLUGIN_ID}/license-key`);
      if (data.licenseKey) {
        setLicenseKey(data.licenseKey);
      }
      setIsEditingLicense(true);
    } catch (error) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('settings.fetch.error') }),
      });
    }
  };

  const handleCancelEditLicense = () => {
    setLicenseKey('');
    setIsEditingLicense(false);
  };

  const handleUpgrade = async () => {
    try {
      const { data } = await post(`/${PLUGIN_ID}/checkout`, {
        returnUrl: window.location.href,
      });
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('settings.subscription.pricingError') }),
      });
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
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
      setPortalLoading(false);
    }
  };

  const handleAutoTaggingToggle = async (enabled: boolean) => {
    setAutoTaggingSaving(true);
    try {
      await post(`/${PLUGIN_ID}/auto-tagging`, { enabled });
      setAutoTagging((prev) => (prev ? { ...prev, enabled } : { enabled, available: false }));
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation(
            enabled ? 'settings.autoTagging.enabled' : 'settings.autoTagging.disabled'
          ),
        }),
      });
    } catch (error) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('settings.autoTagging.error') }),
      });
    } finally {
      setAutoTaggingSaving(false);
    }
  };

  const handleBulkProcessingToggle = async (enabled: boolean) => {
    setBulkProcessingSaving(true);
    try {
      await post(`/${PLUGIN_ID}/bulk-processing`, { enabled });
      setBulkProcessing((prev) => (prev ? { ...prev, enabled } : { enabled, available: false }));
      toggleNotification({
        type: 'success',
        message: formatMessage({
          id: getTranslation(
            enabled ? 'settings.bulkProcessing.enabled' : 'settings.bulkProcessing.disabled'
          ),
        }),
      });
    } catch (error) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({ id: getTranslation('settings.bulkProcessing.error') }),
      });
    } finally {
      setBulkProcessingSaving(false);
    }
  };


  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (hasLicenseKey) {
      fetchSubscription();
    }
  }, [hasLicenseKey, fetchSubscription]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('subscription') === 'success' && hasLicenseKey) {
      toggleNotification({
        type: 'success',
        message: formatMessage({ id: getTranslation('settings.subscription.activatedSuccess') }),
      });
      fetchSubscription();
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.search, hasLicenseKey, fetchSubscription, toggleNotification, formatMessage]);


  if (loading) {
    return (
      <Main>
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          style={{ minHeight: '100vh', width: '100%' }}
        >
          <Loader>
            {formatMessage({ id: getTranslation('settings.loading') })}
          </Loader>
        </Flex>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8} background="neutral100">
        <Box paddingBottom={4}>
          <Typography variant="alpha" as="h1">
            {formatMessage({ id: getTranslation('settings.title') })}
          </Typography>
          <Typography variant="epsilon" textColor="neutral600">
            {formatMessage({ id: getTranslation('settings.description') })}
          </Typography>
        </Box>

        <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius marginBottom={4}>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Flex justifyContent="space-between" alignItems="center">
              <Flex alignItems="center" gap={2}>
                <Key width={20} height={20} />
                <Typography variant="delta">
                  {formatMessage({ id: getTranslation('settings.licenseKey.title') })}
                </Typography>
              </Flex>
              <Box
                background={hasLicenseKey ? 'success100' : 'warning100'}
                paddingTop={1}
                paddingBottom={1}
                paddingLeft={3}
                paddingRight={3}
                hasRadius
              >
                <Typography variant="sigma" textColor={hasLicenseKey ? 'success700' : 'warning700'}>
                  {formatMessage({
                    id: hasLicenseKey
                      ? getTranslation('settings.licenseKey.configured')
                      : getTranslation('settings.licenseKey.notConfigured'),
                  })}
                </Typography>
              </Box>
            </Flex>

            <Typography variant="omega" textColor="neutral600">
              {formatMessage({ id: getTranslation('settings.licenseKey.hint') })}
            </Typography>

            <Flex direction="column" gap={2} alignItems="flex-start">
              {hasLicenseKey && !isEditingLicense ? (
                <Button variant="secondary" onClick={handleEditLicenseKey} startIcon={<Pencil />}>
                  {formatMessage({ id: getTranslation('settings.licenseKey.edit') })}
                </Button>
              ) : (
                <>
                  <Flex gap={3} alignItems="flex-end">
                    <Box style={{ width: '350px' }}>
                      <TextInput
                        label={formatMessage({ id: getTranslation('settings.licenseKey.label') })}
                        type="text"
                        placeholder={formatMessage({
                          id: getTranslation('settings.licenseKey.placeholder'),
                        })}
                        value={licenseKey}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setLicenseKey(e.target.value)
                        }
                        disabled={savingLicense}
                      />
                    </Box>
                    <Flex gap={2}>
                      <Button
                        onClick={handleSaveLicenseKey}
                        disabled={!licenseKey.trim() || savingLicense}
                        loading={savingLicense}
                        startIcon={<Check />}
                      >
                        {formatMessage({
                          id: isEditingLicense
                            ? getTranslation('settings.licenseKey.update')
                            : getTranslation('settings.licenseKey.save'),
                        })}
                      </Button>
                      {isEditingLicense && (
                        <Button
                          variant="tertiary"
                          onClick={handleCancelEditLicense}
                          disabled={savingLicense}
                        >
                          {formatMessage({ id: getTranslation('settings.licenseKey.cancel') })}
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                  <Box
                    as="a"
                    href={pricingData?.dashboardUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    <Typography variant="pi" textColor="primary600">
                      {formatMessage({ id: getTranslation('settings.licenseKey.howToGet') })}
                    </Typography>
                    <ExternalLink width={12} height={12} fill="#4945ff" />
                  </Box>

                  <Box
                    as="a"
                    href="https://form.typeform.com/to/PysBr5yy"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      textDecoration: "none",
                      marginTop: "8px",
                    }}
                  >
                    <Typography variant="pi" textColor="primary600">
                      {formatMessage({ id: getTranslation("settings.feedback") })}
                    </Typography>
                    <ExternalLink width={12} height={12} fill="#4945ff" />
                  </Box>

                </>
              )}
            </Flex>
          </Flex>
        </Box>

        {hasLicenseKey && (
          <>
            <Box marginBottom={4}>
              {subscription?.isActive && subscription?.cancelAtPeriodEnd && (
                <Box background="danger100" padding={3} hasRadius marginBottom={3}>
                  <Typography variant="omega" textColor="danger700">
                    {subscription.currentPeriodEnd
                      ? formatMessage(
                        { id: getTranslation('settings.subscription.cancelledDescription') },
                        {
                          date: new Date(
                            subscription.currentPeriodEnd * 1000
                          ).toLocaleDateString(),
                        }
                      )
                      : formatMessage({
                        id: getTranslation('settings.subscription.cancelledDescriptionNoDate'),
                      })}
                  </Typography>
                </Box>
              )}

              <Box
                background="neutral0"
                shadow="filterShadow"
                hasRadius
                style={{ overflow: 'hidden' }}
              >
                <Grid>
                  <GridItem col={6} s={12} style={{ borderRight: '1px solid #eaeaef20 ' }}>
                    <Box padding={5}>
                      <Typography
                        variant="sigma"
                        textColor="neutral500"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
                      >
                        {formatMessage({ id: getTranslation('settings.subscription.planLabel') })}
                      </Typography>
                      <Box paddingTop={2} paddingBottom={2}>
                        <Typography variant="beta" textColor="neutral800">
                          {subscription?.isActive
                            ? subscription.planName
                            : formatMessage({
                              id: getTranslation('settings.subscription.freePlan'),
                            })}
                        </Typography>
                      </Box>
                      <Box
                        as="button"
                        background="transparent"
                        padding={0}
                        style={{
                          border: 'none',
                          cursor: portalLoading ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={subscription?.isActive ? handleManageSubscription : handleUpgrade}
                        disabled={portalLoading}
                      >
                        <Typography
                          variant="omega"
                          textColor="primary600"
                          style={{ fontWeight: 500 }}
                        >
                          {formatMessage({
                            id: getTranslation(
                              subscription?.isActive
                                ? usage && usage.used >= usage.limit
                                  ? 'settings.subscription.upgradeButton'
                                  : 'settings.subscription.manageButton'
                                : 'settings.subscription.upgradeButton'
                            ),
                          })}
                        </Typography>
                        <ExternalLink width={14} height={14} fill="#4945ff" />
                      </Box>
                    </Box>
                  </GridItem>

                  <GridItem col={6} s={12}>
                    <Box padding={5}>
                      <Typography
                        variant="sigma"
                        textColor="neutral500"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
                      >
                        {formatMessage({ id: getTranslation('settings.usage.title') })}
                      </Typography>
                      {usage && (
                        <>
                          <Box paddingTop={2} paddingBottom={2}>
                            <Flex alignItems="baseline" gap={2}>
                              <Typography variant="beta" textColor="neutral800">
                                {usage.used.toLocaleString()}
                              </Typography>
                              <Typography variant="omega" textColor="neutral500">
                                / {usage.limit.toLocaleString()}
                              </Typography>
                            </Flex>
                          </Box>
                          <Box
                            background="neutral200"
                            hasRadius
                            style={{ height: '6px', overflow: 'hidden', marginBottom: '8px' }}
                          >
                            <Box
                              background={
                                usage.used / usage.limit >= 0.9
                                  ? 'danger500'
                                  : usage.used / usage.limit >= 0.7
                                    ? 'warning500'
                                    : 'success500'
                              }
                              style={{
                                height: '100%',
                                width: `${Math.min((usage.used / usage.limit) * 100, 100)}%`,
                                borderRadius: '4px',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </Box>
                          <Typography variant="pi" textColor="neutral500">
                            {formatMessage(
                              { id: getTranslation('settings.usage.resetsOn') },
                              { date: new Date(usage.periodEnd).toLocaleDateString() }
                            )}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </GridItem>
                </Grid>
              </Box>
            </Box>

            <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius marginBottom={4}>
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Flex alignItems="center" gap={2}>
                  <Magic width={20} height={20} />
                  <Typography variant="delta">
                    {formatMessage({ id: getTranslation('settings.autoTagging.title') })}
                  </Typography>
                  {!autoTagging?.available && (
                    <Box
                      background="neutral100"
                      padding={1}
                      paddingLeft={2}
                      paddingRight={2}
                      hasRadius
                    >
                      <Flex alignItems="center" gap={1}>
                        <Lock width={12} height={12} />
                        <Typography variant="pi" textColor="neutral600">
                          {formatMessage({ id: getTranslation('settings.autoTagging.proFeature') })}
                        </Typography>
                      </Flex>
                    </Box>
                  )}
                </Flex>

                <Typography variant="omega" textColor="neutral600">
                  {formatMessage({ id: getTranslation('settings.autoTagging.description') })}
                </Typography>

                {autoTagging?.available ? (
                  <Box style={{ maxWidth: '318px' }}>
                    <ToggleInput
                      checked={autoTagging.enabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleAutoTaggingToggle(e.target.checked)
                      }
                      disabled={autoTaggingSaving}
                      onLabel={formatMessage({ id: getTranslation('settings.autoTagging.on') })}
                      offLabel={formatMessage({ id: getTranslation('settings.autoTagging.off') })}
                    />
                  </Box>
                ) : (
                  <Box
                    as="button"
                    background="transparent"
                    padding={0}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={subscription?.isActive ? handleManageSubscription : handleUpgrade}
                  >
                    <Typography variant="omega" textColor="primary600" style={{ fontWeight: 500 }}>
                      {formatMessage({ id: getTranslation('settings.autoTagging.upgrade') })}
                    </Typography>
                    <ExternalLink width={14} height={14} fill="#4945ff" />
                  </Box>
                )}
              </Flex>
            </Box>

            <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Flex alignItems="center" gap={2}>
                  <Rocket width={20} height={20} />
                  <Typography variant="delta">
                    {formatMessage({ id: getTranslation('settings.bulkProcessing.title') })}
                  </Typography>
                  {!bulkProcessing?.available && (
                    <Box
                      background="neutral100"
                      padding={1}
                      paddingLeft={2}
                      paddingRight={2}
                      hasRadius
                    >
                      <Flex alignItems="center" gap={1}>
                        <Lock width={12} height={12} />
                        <Typography variant="pi" textColor="neutral600">
                          {formatMessage({
                            id: getTranslation('settings.bulkProcessing.proFeature'),
                          })}
                        </Typography>
                      </Flex>
                    </Box>
                  )}
                </Flex>

                <Typography variant="omega" textColor="neutral600">
                  {formatMessage({ id: getTranslation('settings.bulkProcessing.description') })}
                </Typography>

                {bulkProcessing?.available ? (
                  <Box style={{ maxWidth: '318px' }}>
                    <ToggleInput
                      checked={bulkProcessing.enabled}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleBulkProcessingToggle(e.target.checked)
                      }
                      disabled={bulkProcessingSaving}
                      onLabel={formatMessage({ id: getTranslation('settings.bulkProcessing.on') })}
                      offLabel={formatMessage({ id: getTranslation('settings.bulkProcessing.off') })}
                    />
                  </Box>
                ) : (
                  <Box
                    as="button"
                    background="transparent"
                    padding={0}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={subscription?.isActive ? handleManageSubscription : handleUpgrade}
                  >
                    <Typography variant="omega" textColor="primary600" style={{ fontWeight: 500 }}>
                      {formatMessage({ id: getTranslation('settings.bulkProcessing.upgrade') })}
                    </Typography>
                    <ExternalLink width={14} height={14} fill="#4945ff" />
                  </Box>
                )}
              </Flex>
            </Box>
          </>
        )}
      </Box>
    </Main>
  );
};

export default SettingsPage;
