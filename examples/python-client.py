#!/usr/bin/env python3
"""
Python Client Example for MCP Memory Service
Demonstrates how to interact with the Vercel-deployed API with Clerk authentication
"""

import os
import json
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class MemoryServiceConfig:
    """Configuration for the Memory Service client"""
    base_url: str
    auth_token: str
    timeout: int = 30
    verify_ssl: bool = True


class MemoryServiceClient:
    """Python client for the MCP Memory Service API"""

    def __init__(self, config: MemoryServiceConfig):
        self.config = config
        self.session = requests.Session()

        # Set up headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {config.auth_token}',
            'X-Client-Type': 'python',
            'X-Client-Version': '1.0.0',
            'User-Agent': 'mcp-memory-python-client/1.0.0',
        })

        # Configure session
        self.session.verify = config.verify_ssl
        self.session.timeout = config.timeout

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make a request to the API"""
        url = f"{self.config.base_url.rstrip('/')}/{endpoint.lstrip('/')}"

        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    print(f"Error details: {error_data}")
                except:
                    print(f"Response text: {e.response.text}")
            raise

    def health_check(self) -> Dict[str, Any]:
        """Check the health of the service"""
        return self._request('GET', '/api/health')

    def get_service_info(self) -> Dict[str, Any]:
        """Get service information"""
        return self._request('GET', '/api')

    def add_memory(
        self,
        title: str,
        content: str,
        memory_type: str = "MEMORY",
        importance: int = 2,
        tags: Optional[List[str]] = None,
        entity_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Add a new memory"""
        data = {
            'title': title,
            'content': content,
            'memory_type': memory_type,
            'importance': importance,
            'tags': tags or [],
            'entity_ids': entity_ids or [],
        }
        return self._request('POST', '/api/memories', json=data)

    def search_memories(
        self,
        query: str,
        limit: int = 10,
        threshold: float = 0.7,
        memory_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Search memories"""
        params = {
            'query': query,
            'limit': limit,
            'threshold': threshold,
        }
        if memory_types:
            params['memory_types'] = ','.join(memory_types)

        return self._request('GET', '/api/memories/search', params=params)

    def create_entity(
        self,
        name: str,
        entity_type: str,
        description: Optional[str] = None,
        importance: int = 2,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a new entity"""
        data = {
            'name': name,
            'entity_type': entity_type,
            'importance': importance,
            **kwargs
        }
        if description:
            data['description'] = description

        return self._request('POST', '/api/entities', json=data)

    def search_entities(
        self,
        query: str,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Search entities"""
        params = {
            'query': query,
            'limit': limit,
        }
        return self._request('GET', '/api/entities/search', params=params)

    def unified_search(
        self,
        query: str,
        limit: int = 10,
        threshold: float = 0.7,
        memory_types: Optional[List[str]] = None,
        entity_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Perform unified search across memories and entities"""
        params = {
            'query': query,
            'limit': limit,
            'threshold': threshold,
        }
        if memory_types:
            params['memory_types'] = ','.join(memory_types)
        if entity_types:
            params['entity_types'] = ','.join(entity_types)

        return self._request('GET', '/api/search', params=params)

    def get_statistics(self) -> Dict[str, Any]:
        """Get user statistics"""
        return self._request('GET', '/api/statistics')

    def create_user(
        self,
        email: str,
        name: Optional[str] = None,
        organization: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new user"""
        data = {
            'email': email,
        }
        if name:
            data['name'] = name
        if organization:
            data['organization'] = organization

        return self._request('POST', '/api/users', json=data)


def main():
    """Example usage of the Memory Service client"""

    # Configuration
    config = MemoryServiceConfig(
        base_url=os.getenv('MEMORY_SERVICE_URL', 'https://mcp-memory-ts.vercel.app'),
        auth_token=os.getenv('MEMORY_SERVICE_TOKEN', 'demo-token-for-testing'),
    )

    # Create client
    client = MemoryServiceClient(config)

    try:
        # Health check
        print("=== Health Check ===")
        health = client.health_check()
        print(json.dumps(health, indent=2))

        # Service info
        print("\n=== Service Info ===")
        info = client.get_service_info()
        print(json.dumps(info, indent=2))

        # Add a memory
        print("\n=== Adding Memory ===")
        memory_result = client.add_memory(
            title="Python Client Test",
            content="This memory was created using the Python client library",
            memory_type="MEMORY",
            importance=3,
            tags=["test", "python", "api"]
        )
        print(json.dumps(memory_result, indent=2))

        # Search memories
        print("\n=== Searching Memories ===")
        search_result = client.search_memories(
            query="Python client",
            limit=5
        )
        print(json.dumps(search_result, indent=2))

        # Create an entity
        print("\n=== Creating Entity ===")
        entity_result = client.create_entity(
            name="Python Development Team",
            entity_type="ORGANIZATION",
            description="Team responsible for Python client development",
            importance=3
        )
        print(json.dumps(entity_result, indent=2))

        # Get statistics
        print("\n=== User Statistics ===")
        stats = client.get_statistics()
        print(json.dumps(stats, indent=2))

    except Exception as e:
        print(f"Error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())