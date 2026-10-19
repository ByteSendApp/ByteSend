package bytesend

import (
	"encoding/json"
	"fmt"
)

type ErrorResponse struct {
	Message    string `json:"message"`
	Code       string `json:"code"`
	StatusCode int    `json:"-"`
}

func (e *ErrorResponse) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// StringSlice unmarshals a JSON value that can be either a string or an array of strings
// into a Go []string. This accommodates API responses that may return a single string
// or multiple values interchangeably.
type StringSlice []string

func (s *StringSlice) UnmarshalJSON(b []byte) error {
	// Try to unmarshal as an array of strings first
	var arr []string
	if err := json.Unmarshal(b, &arr); err == nil {
		*s = arr
		return nil
	}

	// Try to unmarshal as a single string
	var single string
	if err := json.Unmarshal(b, &single); err == nil {
		*s = []string{single}
		return nil
	}

	// Accept null as nil slice
	if string(b) == "null" {
		*s = nil
		return nil
	}

	// Fallback: return original error by attempting array once more
	return json.Unmarshal(b, &arr)
}
