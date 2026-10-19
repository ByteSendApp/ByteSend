package bytesend

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

const defaultBaseURL = "https://bytesend.cloud/api/v1"
const userAgent = "bytesend-go/0.3.3"
const maxResponseBodyBytes int64 = 10 * 1024 * 1024 // 10 MB

type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client

	Emails       *EmailsService
	Contacts     *ContactsService
	ContactBooks *ContactBooksService
	Domains      *DomainsService
	Campaigns    *CampaignsService
	Analytics    *AnalyticsService
}

type ClientOption func(*Client)

func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

func WithHTTPClient(h *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = h
	}
}

func NewClient(apiKey string, opts ...ClientOption) (*Client, error) {
	if apiKey == "" {
		apiKey = os.Getenv("BYTESEND_API_KEY")
		if apiKey == "" {
			return nil, errors.New("missing API key")
		}
	}

	c := &Client{
		apiKey:     apiKey,
		baseURL:    defaultBaseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}

	for _, opt := range opts {
		opt(c)
	}

	c.Emails = &EmailsService{client: c}
	c.Contacts = &ContactsService{client: c}
	c.ContactBooks = &ContactBooksService{client: c}
	c.Domains = &DomainsService{client: c}
	c.Campaigns = &CampaignsService{client: c}
	c.Analytics = &AnalyticsService{client: c}

	return c, nil
}

func (c *Client) buildPath(path string, params map[string]string) string {
	v := url.Values{}
	for k, val := range params {
		if val != "" {
			v.Set(k, val)
		}
	}
	if len(v) == 0 {
		return path
	}
	return path + "?" + v.Encode()
}

func (c *Client) doRequest(ctx context.Context, method, path string, body any, v any, extraHeaders map[string]string) error {
	var buf io.Reader
	if body != nil {
		b := &bytes.Buffer{}
		if err := json.NewEncoder(b).Encode(body); err != nil {
			return err
		}
		buf = b
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, buf)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	for k, val := range extraHeaders {
		req.Header.Set(k, val)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	limited := io.LimitReader(resp.Body, maxResponseBodyBytes)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		if v != nil {
			if err := json.NewDecoder(limited).Decode(v); err != nil && err != io.EOF {
				return err
			}
		}
		return nil
	}

	errResp := &ErrorResponse{Message: resp.Status, Code: "INTERNAL_SERVER_ERROR"}
	var envelope struct {
		Error *ErrorResponse `json:"error"`
	}
	if err := json.NewDecoder(limited).Decode(&envelope); err == nil && envelope.Error != nil && envelope.Error.Code != "" {
		errResp = envelope.Error
	}
	errResp.StatusCode = resp.StatusCode
	return errResp
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	return c.doRequest(ctx, http.MethodGet, path, nil, out, nil)
}

func (c *Client) post(ctx context.Context, path string, body any, out any) error {
	return c.doRequest(ctx, http.MethodPost, path, body, out, nil)
}

func (c *Client) postWithHeaders(ctx context.Context, path string, body any, out any, headers map[string]string) error {
	return c.doRequest(ctx, http.MethodPost, path, body, out, headers)
}

func (c *Client) put(ctx context.Context, path string, body any, out any) error {
	return c.doRequest(ctx, http.MethodPut, path, body, out, nil)
}

func (c *Client) patch(ctx context.Context, path string, body any, out any) error {
	return c.doRequest(ctx, http.MethodPatch, path, body, out, nil)
}

func (c *Client) delete(ctx context.Context, path string, body any, out any) error {
	return c.doRequest(ctx, http.MethodDelete, path, body, out, nil)
}
